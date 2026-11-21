import { useEffect, useRef, useState } from 'react'
import { api, ApiError, post, type NodeOption, type Story, type StoryNode } from './api.ts'
import StoryPage from './StoryPage.tsx'
import ThemedLoader from './ThemedLoader.tsx'
import type { Theme } from './themes.ts'

const focusRing = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent'
const secondaryButton = `min-h-11 rounded-xl border-2 border-field px-5 font-semibold transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`

type Props = {
  theme: Theme
  nodeId: number
  onNavigate: (nodeId: number) => void
  onHome: () => void
}

export default function StoryView({ theme, nodeId, onNavigate, onHome }: Props) {
  const [node, setNode] = useState<StoryNode | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [choosing, setChoosing] = useState(false)
  const [chooseError, setChooseError] = useState<string | null>(null)
  const [custom, setCustom] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let ignore = false // a newer node was requested before this one arrived
    api<StoryNode>(`/api/nodes/${nodeId}`)
      .then((n) => {
        if (ignore) return
        setLoadError(null)
        setNode(n)
      })
      .catch((err: Error) => !ignore && setLoadError(err.message))
    return () => {
      ignore = true
    }
  }, [nodeId, reloadKey])

  // After every move, put focus on the new passage's heading for keyboard and screen-reader users.
  useEffect(() => {
    headingRef.current?.focus()
  }, [node?.id])

  function go(id: number) {
    setChooseError(null)
    setCustom('')
    onNavigate(id)
  }

  // An explored option already has its child: walk there with no request (R2).
  // Otherwise ask the backend, which generates the child.
  function pick(option: NodeOption) {
    if (option.child_id !== null) go(option.child_id)
    else void choose({ slot: option.slot })
  }

  async function choose(body: { slot: NodeOption['slot']; text?: string }) {
    if (!node || choosing) return
    setChoosing(true)
    setChooseError(null)
    try {
      const child = await post<StoryNode>(`/api/nodes/${node.id}/choose`, body)
      setNode(child)
      go(child.id)
    } catch (err) {
      setChooseError(err instanceof Error ? err.message : String(err))
      // 409: someone else just wrote this node's custom branch. Reload so it shows as an option.
      if (err instanceof ApiError && err.status === 409) setReloadKey((k) => k + 1)
    } finally {
      setChoosing(false)
    }
  }

  async function startOver() {
    if (!node) return
    try {
      const story = await api<Story>(`/api/stories/${node.story_id}`)
      go(story.root_node_id)
    } catch (err) {
      setChooseError(err instanceof Error ? err.message : String(err))
    }
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
  if (!node) return <p className="text-center text-muted">Opening the tale…</p>

  const parentId = node.parent_id

  return (
    <article>
      {/* D12: the big title and theme picker are on the home page only. */}
      <div className="mb-14 flex items-center justify-between gap-4">
        <button type="button" onClick={onHome} disabled={choosing} className={`whitespace-nowrap ${secondaryButton}`}>
          ← Home
        </button>
        <h1 className="text-right font-display text-xl tracking-wide text-accent sm:text-2xl">Story Interactive</h1>
      </div>

      <div className="relative flow-root">
        {/* Peeks over the book's top edge (TH19); the page, painted after it, hides its lower half. */}
        <theme.Icon className="absolute -top-9 right-8 w-10 animate-float opacity-80 motion-reduce:animate-none" />
        {/* D7: the open book. The left side shows what lies open there (the inside of the cover on page 1,
            the back of the last page after that), cut off by a soft fade at the book's left edge. The
            padding/negative margin give the page's drop shadow room inside the mask; flow-root on the
            wrapper keeps that negative margin from moving the peeking icon. */}
        <div className="-my-10 grid grid-cols-[minmax(0,12fr)_minmax(0,100fr)] py-10 [mask-image:linear-gradient(90deg,transparent,#000_6%)] sm:grid-cols-[minmax(0,30fr)_minmax(0,100fr)] sm:[mask-image:linear-gradient(90deg,transparent,#000_12%)]">
          <div
            aria-hidden="true"
            className={`rounded-l-[0.9rem] ${
              node.level === 1
                ? 'bg-linear-to-bl from-book-cover to-book-cover-deep shadow-[inset_-20px_0_24px_-14px_rgb(0_0_0/0.55)]'
                : 'bg-linear-to-r from-page-back to-page shadow-[inset_-20px_0_24px_-16px_rgb(0_0_0/0.4)]'
            }`}
          />
          {/* D15: one fixed height on every page. Light paper: native scrollbars and inputs follow. */}
          <section className="relative isolate h-[60rem] rounded-r-[0.9rem] bg-page text-page-ink shadow-[0_30px_60px_-25px_rgb(0_0_0/0.85),inset_18px_0_22px_-16px_rgb(0_0_0/0.4)] [color-scheme:light] sm:h-[52rem]">
            {/* -z-10 inside an isolated page: above the paper, below its text and buttons (TH20) */}
            <theme.CardCorner className="absolute right-0 bottom-0 -z-10 w-16 opacity-15" />
            <StoryPage
              theme={theme}
              node={node}
              busy={choosing}
              error={chooseError}
              custom={custom}
              onCustomChange={setCustom}
              onPick={pick}
              onCustom={() => void choose({ slot: 'custom', text: custom })}
              onStartOver={startOver}
              onHome={onHome}
              headingRef={headingRef}
            />
          </section>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        {parentId !== null && (
          <button type="button" onClick={() => go(parentId)} disabled={choosing} className={secondaryButton}>
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
