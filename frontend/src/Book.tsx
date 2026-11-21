import { useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react'

export type CoverState = 'closed' | 'opening' | 'open' | 'closing'
type Direction = 'forward' | 'back'
type Page = (asLeaf: boolean) => ReactNode // asLeaf: a static copy on a turning leaf (no focus target)
type Side = 'none' | 'cover' | 'paper'
type Turn = { direction: Direction; from: Page; fromSide: Side }

// SPEC-3 "Screens and flow": durations, and one easing for every swing.
const TURN_MS = 900
const OPEN_MS = 1200
const CLOSE_MS = 1000
const FADE_MS = 350
const STILL_MS = 200 // reduced motion: every turn and the cover become a cross-fade (R21)
const EASING = 'cubic-bezier(.45,.05,.35,1)'
const FLAT = { transform: 'rotateY(0deg)' }
const OVER = { transform: 'rotateY(-180deg)' } // lying open on the left side

type Props = {
  pageKey: number // a new key turns the page (only while the cover is open)
  direction: Direction // which way the next turn goes; set together with the new key
  firstPage: boolean // page 1: the inside of the cover lies on the left; after that, paper
  cover: CoverState
  coverContent: ReactNode // on the cover's front: the title, or the quill writing the idea
  back?: ReactNode // the Go back control, drawn at the spine's foot while a page (not the cover) lies on the left
  children: Page
  onSettled: () => void // a turn, the opening or the closing (after the fade) has finished
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// The open book (D7, D15): the left side, one fixed-height page, and the leaves that turn over it.
// Presentation only: it never fetches and never decides where a turn goes (R15). Forward, the old page
// lifts away to the left; back, the new page swings in from the left. Each leaf carries an inert,
// aria-hidden copy of its page. Calls onSettled when the motion has finished.
export default function Book({ pageKey, direction, firstPage, cover, coverContent, back, children, onSettled }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const leafRef = useRef<HTMLDivElement>(null)
  const coverRef = useRef<HTMLDivElement>(null)
  const onSettledRef = useRef(onSettled)
  const lastPage = useRef(children) // the page as last drawn, for the leaf of the next forward turn
  const turnLanded = useRef(false)
  useLayoutEffect(() => {
    onSettledRef.current = onSettled
    lastPage.current = children
    // Tell the caller only once the leaf is gone and the live page is back on the sheet, so its
    // heading exists when focus moves to it (R20).
    if (turnLanded.current) {
      turnLanded.current = false
      onSettled()
    }
  })

  // A new key while the book is open starts a turn (state adjusted during render, so the leaf is in the
  // very first frame of the new page).
  const side: Side = firstPage ? 'cover' : 'paper'
  const [seen, setSeen] = useState({ key: pageKey, side })
  const [turn, setTurn] = useState<Turn | null>(null)
  if (seen.key !== pageKey) {
    setSeen({ key: pageKey, side })
    // Read once, when the key changes: the page exactly as it was last drawn rides away on the leaf.
    // eslint-disable-next-line react-hooks/refs
    if (cover === 'open') setTurn({ direction, from: lastPage.current, fromSide: seen.side })
  }

  // The left side: nothing while closed, otherwise what lies open there. A forward leaf lands on it, so
  // it changes once the leaf is down; a back leaf leaves from it, so it changes at once.
  const left: Side =
    cover !== 'open' ? 'none' : turn?.direction === 'forward' ? turn.fromSide : side

  useLayoutEffect(() => {
    const leaf = leafRef.current
    if (!turn || !leaf) return
    const still = reducedMotion()
    const frames = still ? [{ opacity: 1 }, { opacity: 0 }] : [FLAT, OVER]
    const animation = leaf.animate(turn.direction === 'forward' ? frames : [...frames].reverse(), {
      duration: still ? STILL_MS : TURN_MS,
      easing: EASING,
      fill: 'both',
    })
    animation.finished.then(
      () => {
        turnLanded.current = true
        setTurn(null) // the next commit calls onSettled
      },
      () => undefined, // cancelled: unmounted mid-turn
    )
    return () => animation.cancel()
  }, [turn])

  useLayoutEffect(() => {
    const leaf = coverRef.current
    const root = rootRef.current
    if ((cover !== 'opening' && cover !== 'closing') || !leaf || !root) return
    const still = reducedMotion()
    const frames = still ? [{ opacity: 1 }, { opacity: 0 }] : [FLAT, OVER]
    const options = { easing: EASING, fill: 'both' as const }
    const animations: Animation[] = []
    let cancelled = false
    const swing = leaf.animate(cover === 'opening' ? frames : [...frames].reverse(), {
      ...options,
      duration: still ? STILL_MS : cover === 'opening' ? OPEN_MS : CLOSE_MS,
    })
    animations.push(swing)
    void swing.finished
      .then(async () => {
        if (cover === 'closing') {
          const fade = root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, fill: 'forwards' })
          animations.push(fade)
          await fade.finished
        }
        if (!cancelled) onSettledRef.current()
      })
      .catch(() => undefined) // cancelled: unmounted mid-swing
    return () => {
      cancelled = true
      animations.forEach((a) => a.cancel())
    }
  }, [cover])

  const coverMoving = cover === 'opening' || cover === 'closing'
  // During a back turn the old page stays on the sheet until the leaf lands on it.
  const sheetPage = turn?.direction === 'back' ? turn.from(true) : children(false)
  const leafPage = turn ? (turn.direction === 'forward' ? turn.from(true) : children(true)) : null

  return (
    // overflow-x: clip, so a swinging leaf never makes the window scroll sideways
    <div ref={rootRef} className="relative overflow-x-clip">
      {/* The padding/negative margin give the page's drop shadow room inside the mask. */}
      <div className="-my-10 grid grid-cols-[minmax(0,12fr)_minmax(0,100fr)] py-10 [mask-image:linear-gradient(90deg,transparent,#000_6%)] [perspective:2200px] sm:grid-cols-[minmax(0,30fr)_minmax(0,100fr)] sm:[mask-image:linear-gradient(90deg,transparent,#000_12%)]">
        <div aria-hidden="true" className={`rounded-l-[0.9rem] ${SIDE_STYLE[left]}`} />
        {/* D15: one fixed height for every page and the cover. Light paper: native scrollbars and inputs follow. */}
        <div className="relative h-[60rem] rounded-r-[0.9rem] bg-page text-page-ink shadow-[0_30px_60px_-25px_rgb(0_0_0/0.85),inset_18px_0_22px_-16px_rgb(0_0_0/0.4)] [color-scheme:light] [transform-style:preserve-3d] sm:h-[52rem]">
          <div className="relative isolate h-full">{sheetPage}</div>

          {leafPage && (
            <Leaf leafRef={leafRef} front={<div className="relative isolate h-full">{leafPage}</div>} back={<Paper />} />
          )}

          {cover !== 'open' && (
            <Leaf
              leafRef={coverRef}
              interactive={!coverMoving} // the closed cover can carry an error and buttons (R19)
              cover
              front={<CoverFront>{coverContent}</CoverFront>}
              back={<div className={`h-full ${SIDE_STYLE.cover}`} />}
            />
          )}
        </div>
      </div>
      {/* Outside the faded mask so it stays fully visible; its left edge is the spine. bottom-16: the 2.5rem shadow room below the page, plus 1.5rem. */}
      {back && left === 'paper' && (
        <div className="absolute bottom-16 left-[calc(100%*12/112)] z-20 sm:left-[calc(100%*30/130)]">{back}</div>
      )}
    </div>
  )
}

const SIDE_STYLE: Record<Side, string> = {
  none: '',
  cover:
    'bg-linear-to-bl from-book-cover to-book-cover-deep shadow-[inset_-20px_0_24px_-14px_rgb(0_0_0/0.55)]',
  paper: 'bg-linear-to-r from-page-back to-page shadow-[inset_-20px_0_24px_-16px_rgb(0_0_0/0.4)]',
}

function Paper() {
  return <div className={`h-full ${SIDE_STYLE.paper}`} />
}

// A leaf turning around the spine (the sheet's left edge): a front face and, turned over, a back face.
function Leaf(props: {
  leafRef: Ref<HTMLDivElement>
  front: ReactNode
  back: ReactNode
  cover?: boolean
  interactive?: boolean
}) {
  const { leafRef, front, back, cover = false, interactive = false } = props
  return (
    <div
      ref={leafRef}
      inert={!interactive}
      aria-hidden={interactive ? undefined : true}
      className="absolute inset-0 z-10 origin-left [transform-style:preserve-3d]"
    >
      <div
        className={`relative h-full overflow-hidden [backface-visibility:hidden] ${
          cover
            ? 'rounded-l-[0.3rem] rounded-r-[0.9rem]'
            : 'rounded-r-[0.9rem] bg-page shadow-[-8px_0_30px_-10px_rgb(0_0_0/0.35)]'
        }`}
      >
        {front}
      </div>
      <div className="absolute inset-0 overflow-hidden rounded-l-[0.9rem] [backface-visibility:hidden] [transform:rotateY(180deg)]">
        {back}
      </div>
    </div>
  )
}

// The shared cover (D14), coloured by tokens: a foil frame, two small ornaments and the content between.
function CoverFront({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-full bg-linear-to-bl from-book-cover to-book-cover-deep shadow-[inset_14px_0_0_-6px_rgb(0_0_0/0.35)]">
      <div className="absolute inset-[1.1rem] rounded-[0.3rem] border-2 border-foil/70 shadow-[inset_0_0_0_6px] shadow-foil/20" />
      <Ornament className="absolute top-8 left-1/2 w-14 -translate-x-1/2" />
      <Ornament className="absolute bottom-8 left-1/2 w-14 -translate-x-1/2 rotate-180" />
      <div className="absolute inset-x-[14%] inset-y-[24%] flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  )
}

function Ornament({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 60 16" aria-hidden="true" className={`text-foil opacity-85 ${className}`}>
      <path d="M2 8h18M40 8h18" stroke="currentColor" strokeWidth={1.5} fill="none" />
      <path d="M30 2l6 6-6 6-6-6z" stroke="currentColor" strokeWidth={1.5} fill="none" />
      <circle cx={30} cy={8} r={1.6} fill="currentColor" />
    </svg>
  )
}
