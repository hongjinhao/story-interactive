import { useEffect, useRef, useState } from 'react'
import { api, ApiError, post, type NodeOption, type Story, type StoryNode } from './api.ts'
import Book, { type CoverState } from './Book.tsx'
import StoryPage from './StoryPage.tsx'
import ThemedLoader from './ThemedLoader.tsx'
import type { Theme } from './themes.ts'

const focusRing = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent'
const secondaryButton = `min-h-11 rounded-xl border-2 border-field px-5 font-semibold transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`

type Props = {
  theme: Theme
  nodeId: number // the page the book opens on
  onHome: () => void
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

// The story as a book (SPEC-3). Owns the data and the flow: every move fetches first and turns after,
// so a turn only ever goes where the tree says (R15, R16). Book and StoryPage only draw.
export default function StoryView({ theme, nodeId, onHome }: Props) {
  const [node, setNode] = useState<StoryNode | null>(null)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [cover, setCover] = useState<CoverState>('closed')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [choosing, setChoosing] = useState(false) // POST /choose in flight
  const [moving, setMoving] = useState(false) // a walk's GET in flight, or a turn running
  const [chooseError, setChooseError] = useState<string | null>(null)
  const [custom, setCustom] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)

  // R17: while anything is moving, every control in the book is disabled.
  const busy = choosing || moving || cover !== 'open'

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

  // Show a node that the backend returned. A different node turns the page (busy until onSettled);
  // the same node (a reload) just redraws it.
  function show(next: StoryNode, way: 'forward' | 'back') {
    if (next.id === node?.id) {
      setNode(next)
      setMoving(false)
      return
    }
    setDirection(way)
    setNode(next)
    setCustom('')
    setChooseError(null)
  }

  // A walk: fetch first, turn once the tree has answered (R15). Errors stay on this page.
  async function walkTo(id: number, way: 'forward' | 'back') {
    if (busy) return
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
    if (option.child_id !== null) void walkTo(option.child_id, 'forward')
    else void choose({ slot: option.slot })
  }

  async function choose(body: { slot: NodeOption['slot']; text?: string }) {
    if (!node || busy) return
    setChoosing(true)
    setChooseError(null)
    try {
      const child = await post<StoryNode>(`/api/nodes/${node.id}/choose`, body)
      setMoving(true)
      show(child, 'forward')
    } catch (err) {
      setChooseError(message(err))
      // 409: someone else just wrote this node's custom branch. Reload so it shows as an option.
      if (err instanceof ApiError && err.status === 409) {
        api<StoryNode>(`/api/nodes/${node.id}`)
          .then((n) => setNode(n))
          .catch(() => undefined) // the 409 message is already showing
      }
    } finally {
      setChoosing(false)
    }
  }

  // The ending's "Start over": one backward turn to page 1.
  async function startOver() {
    if (!node || busy) return
    setMoving(true)
    try {
      const story = await api<Story>(`/api/stories/${node.story_id}`)
      setMoving(false)
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
    setMoving(false)
    headingRef.current?.focus() // R20
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

  const parentId = node?.parent_id ?? null

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
          pageKey={node?.id ?? 0}
          direction={direction}
          firstPage={node?.parent_id === null}
          cover={cover}
          coverContent={
            <p className="font-story text-3xl leading-tight font-semibold text-foil italic sm:text-4xl">{node?.story_title}</p>
          }
          onSettled={settled}
        >
          {(asLeaf) =>
            node && (
              <>
                {/* -z-10 inside an isolated page: above the paper, below its text and buttons (TH20) */}
                <theme.CardCorner className="absolute right-0 bottom-0 -z-10 w-16 opacity-15" />
                <StoryPage
                  theme={theme}
                  node={node}
                  busy={asLeaf || busy}
                  error={chooseError}
                  custom={custom}
                  onCustomChange={setCustom}
                  onPick={pick}
                  onCustom={() => void choose({ slot: 'custom', text: custom })}
                  onStartOver={startOver}
                  onHome={home}
                  headingRef={asLeaf ? undefined : headingRef}
                />
              </>
            )
          }
        </Book>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        {parentId !== null && (
          <button type="button" onClick={() => void walkTo(parentId, 'back')} disabled={busy} className={secondaryButton}>
            ↑ Go back
          </button>
        )}
        {/* Filled while waiting once the quill replaces ThemedLoader (PLAN-3 Step 6). */}
        <p role="status" aria-live="polite" className="min-h-[1.6em] text-muted italic" />
      </div>

      {choosing && <ThemedLoader message={theme.copy.choosing} slowMessage={theme.copy.slow} Icon={theme.Icon} />}
    </article>
  )
}
