import { useEffect, useRef, useState } from 'react'
import { api, ApiError, post, type NodeOption, type Story, type StoryNode } from './api.ts'
import Book, { type CoverState } from './Book.tsx'
import QuillWriting from './QuillWriting.tsx'
import StoryPage from './StoryPage.tsx'
import type { Theme } from './themes.ts'

const SLOW_AFTER_MS = 10_000 // SPEC: say so if Grok takes more than 10 s (the backend gives up at 30 s)
const NUMBERING_GAP_PX = 12 // room left above the page-numbering line when a turn scrolls up to it

const focusRing = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent'
const secondaryButton = `min-h-11 rounded-xl border-2 border-field px-5 font-semibold transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`

type Props = {
  theme: Theme
  start: { idea: string } | { nodeId: number } // create a story from an idea (D13), or open a saved page
  onHome: (idea?: string) => void // the idea comes back only from a failed create, to refill the form (R19)
}

const COVER_SIZES = [36, 32, 28, 24, 22, 20, 18] // the idea on the cover shrinks, then truncates (R23)
// On the closed cover (R19): foil on the cover colours (9.2:1 / 6.2:1), and the cover's deep colour on foil.
const coverRing = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foil'
const coverPrimary = `min-h-11 rounded-xl border-2 border-foil bg-foil px-5 font-semibold text-book-cover-deep ${coverRing}`
const coverSecondary = `min-h-11 rounded-xl border-2 border-foil/70 px-5 font-semibold text-foil transition hover:border-foil ${coverRing}`

// A page being generated (SPEC-3 "Pick a new option"): it is filled once the backend has answered, the
// quill has written the action and the blank page has landed, or turned back if the request failed.
type Draft = {
  from: StoryNode // the page the player chose on
  action: string
  result: StoryNode | null
  error: unknown
  written: boolean
  turned: boolean
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

// The blank page's header while Grok writes: the same story, one page further, with the chosen action.
// Only drawn, never treated as a node (R15): it has no passage and no choices.
const blankPage = (from: StoryNode, action: string): StoryNode => ({
  ...from,
  level: from.level + 1,
  parent_id: from.id,
  choice_text: action,
  content: '',
  options: [],
  can_add_custom: false,
  is_ending: false,
})

// The story as a book (SPEC-3). Owns the data and the flow: a walk fetches first and turns after; a new
// choice turns to a blank page at once and fills it only from the node the backend returns (R15, R16).
// Book and StoryPage only draw.
export default function StoryView({ theme, start, onHome }: Props) {
  const idea = 'idea' in start ? start.idea : null
  const [node, setNode] = useState<StoryNode | null>(null) // the last page the tree gave us
  const [pageKey, setPageKey] = useState(0) // +1 on every turn; Book turns when it changes
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [cover, setCover] = useState<CoverState>('closed')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [moving, setMoving] = useState(false) // a fetch, a turn or a generation is running
  const [draft, setDraftState] = useState<Draft | null>(null)
  const draftRef = useRef<Draft | null>(null) // the same draft, for handlers that finish later
  const [quillKey, setQuillKey] = useState<number | null>(null) // the page whose action the quill wrote
  const [inkId, setInkId] = useState<number | null>(null) // the node that inks in (just generated)
  const [slow, setSlow] = useState(false)
  // Creating (SPEC-3 "New story"): the cover opens once the story is back and the idea is written.
  const [attempt, setAttempt] = useState(0) // "Try again" sends the same idea once more
  const [createError, setCreateError] = useState<string | null>(null)
  const opening = useRef({ node: null as StoryNode | null, written: idea === null, opened: false })
  const createdRoot = useRef<number | null>(null) // created but the page didn't load: retry the GET only
  const [chooseError, setChooseError] = useState<string | null>(null)
  const [custom, setCustom] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)

  // R17: while anything is moving, every control in the book is disabled.
  const busy = moving || cover !== 'open'

  // Load the first page. A saved story: the closed cover with its title, then straight open (no pen).
  // A new idea: create it (in this theme's bank, R8), then load its first page, while the quill writes.
  const startNode = 'nodeId' in start ? start.nodeId : null
  useEffect(() => {
    let ignore = false
    const rootId = async () => {
      if (startNode !== null) return startNode
      if (createdRoot.current === null) {
        const story = await post<Story>('/api/stories', { idea, theme: theme.id })
        createdRoot.current = story.root_node_id
      }
      return createdRoot.current
    }
    rootId()
      .then((id) => api<StoryNode>(`/api/nodes/${id}`))
      .then((n) => {
        if (ignore) return
        opening.current.node = n
        openWhenReady()
      })
      .catch((err: unknown) => {
        if (ignore) return
        if (idea === null) setLoadError(message(err))
        else setCreateError(message(err)) // R19: on the cover, with Try again and Home
      })
    return () => {
      ignore = true
    }
    // `openWhenReady` only reads refs and setters; `idea` and the theme are fixed for this book.
  }, [startNode, attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  function openWhenReady() {
    const { node: first, written, opened } = opening.current
    if (!first || !written || opened) return // opens once; a later onWritten must not reopen it
    opening.current.opened = true
    setNode(first)
    setCover('opening')
  }

  function retryCreate() {
    opening.current.written = false // the quill writes the idea again while it waits
    setCreateError(null)
    setSlow(false)
    setAttempt((n) => n + 1)
  }

  // The status line: creating or choosing, then "slow" after 10 s (SPEC: say so past 10 seconds).
  const creating = idea !== null && cover === 'closed' && createError === null
  const generating = draft !== null
  const waiting = creating || generating
  useEffect(() => {
    if (!waiting) return
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [waiting, attempt])

  function setDraft(next: Draft | null) {
    draftRef.current = next
    setDraftState(next)
  }

  function turn(way: 'forward' | 'back') {
    showNumbering()
    setDirection(way)
    setPageKey((k) => k + 1)
  }

  // Scrolled down to the choices? Bring the page-numbering line back into view as the turn starts, and
  // no further (the line sits at the same place on every page). Smooth, or instant with reduced motion.
  function showNumbering() {
    const line = headingRef.current?.parentElement // the row with the title and "Page n of max"
    if (!line) return
    const top = line.getBoundingClientRect().top - NUMBERING_GAP_PX
    if (top >= 0) return // already on screen
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollBy({ top, behavior: still ? 'instant' : 'smooth' })
  }

  // Show a node from a walk. A different node turns the page (busy until onSettled); the same node (a
  // reload) just redraws it.
  function show(next: StoryNode, way: 'forward' | 'back') {
    if (next.id === node?.id) {
      setNode(next)
      setMoving(false)
      return
    }
    setNode(next)
    setInkId(null)
    setCustom('')
    setChooseError(null)
    turn(way)
  }

  // A walk: fetch first, turn once the tree has answered (R15). Errors stay on this page.
  async function walkTo(id: number, way: 'forward' | 'back') {
    setMoving(true)
    setChooseError(null)
    try {
      show(await api<StoryNode>(`/api/nodes/${id}`), way)
    } catch (err) {
      setChooseError(message(err))
      setMoving(false)
    }
  }

  // An explored option already has its child: walk there with no LLM call (R2).
  // Otherwise ask the backend, which generates the child.
  function pick(option: NodeOption) {
    if (busy) return
    if (option.child_id !== null) void walkTo(option.child_id, 'forward')
    else void generate({ slot: option.slot }, option.text)
  }

  // A new branch: send the request, and turn to a blank page at once while the quill writes the action.
  async function generate(body: { slot: NodeOption['slot']; text?: string }, action: string) {
    if (!node || busy) return
    setMoving(true)
    setChooseError(null)
    setSlow(false)
    setDraft({ from: node, action, result: null, error: null, written: false, turned: false })
    setQuillKey(pageKey + 1)
    turn('forward')
    try {
      advance({ result: await post<StoryNode>(`/api/nodes/${node.id}/choose`, body) })
    } catch (err) {
      advance({ error: err })
    }
  }

  // One more thing about the draft is known. Fill the page once everything is in, or turn back on an
  // error once the blank page has landed.
  function advance(patch: Partial<Draft>) {
    const current = draftRef.current
    if (!current) return
    const next = { ...current, ...patch }
    if (next.turned && next.error) return failDraft(next)
    if (next.turned && next.written && next.result) return fillDraft(next.result)
    setDraft(next)
  }

  function fillDraft(result: StoryNode) {
    setDraft(null)
    setNode(result)
    setInkId(result.id)
    setCustom('')
    setMoving(false)
  }

  // R18: back to the page the player was on, the error under its choices, the typed action kept.
  // 409: someone else just wrote this node's custom branch, so reload the page to list it.
  function failDraft(failed: Draft) {
    setDraft(null)
    setChooseError(message(failed.error))
    turn('back') // `node` is still the page it was chosen on; moving stays on until the turn settles
    if (failed.error instanceof ApiError && failed.error.status === 409) {
      api<StoryNode>(`/api/nodes/${failed.from.id}`)
        .then(setNode)
        .catch(() => undefined) // the 409 message is already showing
    }
  }

  // The ending's "Start over": one backward turn to page 1.
  async function startOver() {
    if (!node || busy) return
    setMoving(true)
    try {
      const story = await api<Story>(`/api/stories/${node.story_id}`)
      await walkTo(story.root_node_id, 'back')
    } catch (err) {
      setChooseError(message(err))
      setMoving(false)
    }
  }

  function home() {
    if (createError) return onHome(idea ?? undefined) // the book never opened: back to the form, idea kept
    if (busy) return
    setCover('closing') // Book closes the cover and fades out, then onSettled leaves
  }

  // A turn, the opening or the closing has finished.
  function settled() {
    if (cover === 'closing') return onHome()
    if (cover === 'opening') setCover('open')
    headingRef.current?.focus({ preventScroll: true }) // R20; showNumbering already scrolled
    if (draftRef.current && !draftRef.current.turned) return advance({ turned: true }) // still generating
    setMoving(false)
  }

  if (loadError) {
    return (
      <section className="rounded-2xl border border-edge bg-surface p-5 sm:p-8">
        <p role="alert" className="text-danger">
          Couldn't open this part of the tale: {loadError}
        </p>
        <button type="button" onClick={() => onHome()} className={`mt-4 ${secondaryButton}`}>
          Back to home
        </button>
      </section>
    )
  }

  const page = draft ? blankPage(draft.from, draft.action) : node
  const parentId = draft ? null : (node?.parent_id ?? null)

  return (
    <article className="animate-fade-in motion-reduce:animate-none">
      {/* D12: the big title and theme picker are on the home page only. */}
      <div className="mb-14 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={home}
          disabled={busy && !createError}
          className={`whitespace-nowrap ${secondaryButton}`}
        >
          ← Home
        </button>
        <h1 className="text-right font-display text-xl tracking-wide text-accent sm:text-2xl">Story Interactive</h1>
      </div>

      {/* flow-root keeps the book's negative margin from moving the peeking icon */}
      <div className="relative flow-root">
        {/* Peeks over the book's top edge (TH19); the page, painted after it, hides its lower half. */}
        <theme.Icon className="absolute -top-9 right-8 w-10 animate-float opacity-80 motion-reduce:animate-none" />
        <Book
          pageKey={pageKey}
          direction={direction}
          firstPage={page?.parent_id === null}
          cover={cover}
          coverContent={
            // The quill writes the idea on the way in; on the way out the cover shows the title.
            idea === null || cover === 'closing' ? (
              <p className="font-story text-3xl leading-tight font-semibold text-foil italic sm:text-4xl">
                {node?.story_title}
              </p>
            ) : createError ? (
              // R19: the error on the closed book, with Try again (the same idea) and Home (the form, idea kept)
              <div className="flex flex-col items-center gap-4">
                <p className="line-clamp-3 font-story text-xl font-semibold text-foil italic">{idea}</p>
                <p role="alert" className="text-foil">
                  Couldn't start this tale: {createError}
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button type="button" onClick={retryCreate} autoFocus className={coverPrimary}>
                    Try again
                  </button>
                  <button type="button" onClick={() => onHome(idea)} className={coverSecondary}>
                    Home
                  </button>
                </div>
              </div>
            ) : (
              <QuillWriting
                key={attempt}
                text={idea}
                Quill={theme.Quill}
                waiting={cover === 'closed'}
                font="cover"
                center
                fit
                sizes={COVER_SIZES}
                maxMs={4000}
                className="h-full w-full text-foil [text-shadow:0_1px_0_rgb(0_0_0/0.45)]"
                onWritten={() => {
                  opening.current.written = true
                  openWhenReady()
                }}
              />
            )
          }
          onSettled={settled}
        >
          {(asLeaf) =>
            page && (
              <>
                {/* -z-10 inside an isolated page: above the paper, below its text and buttons (TH20) */}
                <theme.CardCorner className="absolute right-0 bottom-0 -z-10 w-16 opacity-15" />
                <StoryPage
                  theme={theme}
                  node={page}
                  busy={asLeaf || busy}
                  error={draft ? null : chooseError}
                  custom={custom}
                  onCustomChange={setCustom}
                  onPick={pick}
                  onCustom={() => void generate({ slot: 'custom', text: custom }, custom.trim())}
                  onStartOver={startOver}
                  onHome={home}
                  headingRef={asLeaf ? undefined : headingRef}
                  waitingText={draft ? theme.copy.choosing : undefined}
                  inkIn={!asLeaf && !draft && node?.id === inkId}
                  // The quill stays on the page it wrote, so it can finish and lift away. Copies on a
                  // turning leaf show the plain text instead of writing it again.
                  action={
                    !asLeaf && quillKey === pageKey && page.choice_text ? (
                      <QuillWriting
                        key={quillKey}
                        text={page.choice_text}
                        Quill={theme.Quill}
                        waiting={draft !== null}
                        font="action"
                        sizes={[18]}
                        maxMs={2500}
                        onWritten={() => advance({ written: true })}
                      />
                    ) : undefined
                  }
                />
              </>
            )
          }
        </Book>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        {parentId !== null && (
          <button type="button" onClick={() => !busy && void walkTo(parentId, 'back')} disabled={busy} className={secondaryButton}>
            ↑ Go back
          </button>
        )}
        <p role="status" aria-live="polite" className="ml-auto min-h-[1.6em] text-muted italic">
          {waiting ? (slow ? theme.copy.slow : creating ? theme.copy.creating : theme.copy.choosing) : ''}
        </p>
      </div>
    </article>
  )
}
