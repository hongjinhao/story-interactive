import { useEffect, useRef, useState } from 'react'
import { api, ApiError, post, type NodeOption, type Story, type StoryNode } from './api.ts'
import Book, { type CoverState } from './Book.tsx'
import QuillWriting from './QuillWriting.tsx'
import StoryPage from './StoryPage.tsx'
import type { Theme } from './themes.ts'

const SLOW_AFTER_MS = 10_000 // SPEC: say so if Grok takes more than 10 s (the backend gives up at 30 s)

const focusRing = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent'
const secondaryButton = `min-h-11 rounded-xl border-2 border-field px-5 font-semibold transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`

type Props = {
  theme: Theme
  nodeId: number // the page the book opens on
  onHome: () => void
}

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
export default function StoryView({ theme, nodeId, onHome }: Props) {
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
  const [chooseError, setChooseError] = useState<string | null>(null)
  const [custom, setCustom] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)

  // R17: while anything is moving, every control in the book is disabled.
  const busy = moving || cover !== 'open'

  // Open the book: the closed cover with the title, then straight open (no pen for a saved story).
  useEffect(() => {
    let ignore = false
    api<StoryNode>(`/api/nodes/${nodeId}`)
      .then((n) => {
        if (ignore) return
        setNode(n)
        setCover('opening')
      })
      .catch((err: unknown) => !ignore && setLoadError(message(err)))
    return () => {
      ignore = true
    }
  }, [nodeId])

  // The status line says when Grok is slow (as ThemedLoader did).
  const generating = draft !== null
  useEffect(() => {
    if (!generating) return
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [generating])

  function setDraft(next: Draft | null) {
    draftRef.current = next
    setDraftState(next)
  }

  function turn(way: 'forward' | 'back') {
    setDirection(way)
    setPageKey((k) => k + 1)
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
    if (busy) return
    setCover('closing') // Book closes the cover and fades out, then onSettled leaves
  }

  // A turn, the opening or the closing has finished.
  function settled() {
    if (cover === 'closing') return onHome()
    if (cover === 'opening') setCover('open')
    headingRef.current?.focus() // R20
    if (draftRef.current && !draftRef.current.turned) return advance({ turned: true }) // still generating
    setMoving(false)
  }

  if (loadError) {
    return (
      <section className="rounded-2xl border border-edge bg-surface p-5 sm:p-8">
        <p role="alert" className="text-danger">
          Couldn't open this part of the tale: {loadError}
        </p>
        <button type="button" onClick={onHome} className={`mt-4 ${secondaryButton}`}>
          Back to home
        </button>
      </section>
    )
  }

  const page = draft ? blankPage(draft.from, draft.action) : node
  const parentId = draft ? null : (node?.parent_id ?? null)

  return (
    <article>
      {/* D12: the big title and theme picker are on the home page only. */}
      <div className="mb-14 flex items-center justify-between gap-4">
        <button type="button" onClick={home} disabled={busy} className={`whitespace-nowrap ${secondaryButton}`}>
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
            <p className="font-story text-3xl leading-tight font-semibold text-foil italic sm:text-4xl">{node?.story_title}</p>
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
          {draft ? (slow ? theme.copy.slow : theme.copy.choosing) : ''}
        </p>
      </div>
    </article>
  )
}
