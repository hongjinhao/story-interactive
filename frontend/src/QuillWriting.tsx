import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react'

// How the quill writes (SPEC-3 D14, R22): always Lora, never a handwriting font.
type QuillFont = { style: 'normal' | 'italic'; weight: number; lineHeight: number }
const FONTS: Record<'action' | 'cover', QuillFont> = {
  action: { style: 'normal', weight: 400, lineHeight: 1.55 }, // the action box
  cover: { style: 'italic', weight: 600, lineHeight: 1.2 }, // the idea on the cover
}

const MS_PER_CHAR = 50 // SPEC-3 "Quill speed", lowered as needed to stay inside maxMs
const LEAD_MS = 250 // the pen gliding in before the first stroke
const HOP_MS = 200 // lifting the pen to the start of the next line
const LEAVE_MS = 500 // the pen lifting away once nothing is left to wait for
const TRUNCATE_AT = 90 // characters kept when even the smallest size doesn't fit (SPEC-3 edge cases)

type Line = { text: string; width: number }
type Layout = { size: number; lineHeight: number; lines: Line[]; top: number; width: number; height: number }
type Phase = 'writing' | 'written' | 'gone'

type Props = {
  text: string
  Quill: ComponentType<{ className?: string }> // the theme's hand and pen (TH32)
  waiting: boolean // still waiting for Grok: once the writing is done the pen taps; false lets it leave
  font: keyof typeof FONTS
  center?: boolean // centre each line (the cover)
  fit?: boolean // fill this box's fixed height: shrink through `sizes`, then truncate with "…" (R23)
  sizes: number[] // px, largest first; without `fit` only the first is used
  maxMs: number // the whole text is written within this (2.5 s for an action, 4 s for an idea)
  className?: string // colour, and the height when `fit` is set
  onWritten?: () => void // the ink is down (at once with reduced motion)
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const canvasFont = (font: QuillFont, size: number) => `${font.style} ${font.weight} ${size}px Lora, Georgia, serif`

// Words into lines no wider than `width`, measured with a canvas in the same font the lines are drawn in.
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): Line[] {
  const lines: Line[] = []
  let current = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word
    if (current && ctx.measureText(next).width > width) {
      lines.push({ text: current, width: ctx.measureText(current).width })
      current = word
    } else current = next
  }
  if (current) lines.push({ text: current, width: ctx.measureText(current).width })
  return lines
}

function layOut(text: string, box: HTMLElement, font: QuillFont, sizes: number[], fit: boolean): Layout {
  const ctx = document.createElement('canvas').getContext('2d')!
  const width = box.clientWidth
  const maxHeight = fit ? box.clientHeight : Infinity
  const tryAt = (size: number, words: string) => {
    ctx.font = canvasFont(font, size)
    return { size, lineHeight: size * font.lineHeight, lines: wrap(ctx, words, width) }
  }
  const fits = (l: ReturnType<typeof tryAt>) => l.lines.length * l.lineHeight <= maxHeight

  let best = tryAt(sizes[0], text)
  for (const size of fit ? sizes : sizes.slice(0, 1)) {
    best = tryAt(size, text)
    if (fits(best)) break
  }
  if (!fits(best)) {
    // Smallest size and still too long: the first 90 characters and "…", and if that is still too long,
    // as many lines as fit with the last one ending in "…".
    best = tryAt(sizes[sizes.length - 1], `${text.slice(0, TRUNCATE_AT).trimEnd()}…`)
    const room = Math.max(1, Math.floor(maxHeight / best.lineHeight))
    if (best.lines.length > room) {
      const kept = best.lines.slice(0, room)
      let last = kept[room - 1].text.replace(/…$/, '')
      while (last && ctx.measureText(`${last}…`).width > width) last = last.replace(/\s*\S+$/, '')
      kept[room - 1] = { text: `${last}…`, width: ctx.measureText(`${last}…`).width }
      best = { ...best, lines: kept }
    }
  }
  const textHeight = best.lines.length * best.lineHeight
  const height = fit ? maxHeight : textHeight
  return { ...best, top: (height - textHeight) / 2, width, height }
}

// Writes `text` line by line with the theme's Quill following the edge of the ink (SPEC-3 D11). Each line
// is revealed with an animated clip-path (Web Animations API) while the pen moves along it, wiggling while
// the nib is down. Afterwards the pen taps while `waiting`, then lifts away. The animated lines are
// aria-hidden; a visually hidden copy carries the text. Reduced motion: the same lines at once, no pen,
// and onWritten right away (R21).
export default function QuillWriting(props: Props) {
  const { text, Quill, waiting, center = false, fit = false, sizes, maxMs, className = '', onWritten } = props
  const font = FONTS[props.font]
  const sizesKey = sizes.join(' ') // a stable dependency even when the caller passes a new array
  const boxRef = useRef<HTMLDivElement>(null)
  const penRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([])
  const [still] = useState(reducedMotion)
  const [layout, setLayout] = useState<Layout | null>(null)
  const [phase, setPhase] = useState<Phase>('writing')
  const [nibDown, setNibDown] = useState(false)
  const onWrittenRef = useRef(onWritten)
  useLayoutEffect(() => {
    onWrittenRef.current = onWritten
  })

  // Measure once Lora is ready, so the canvas measures the font the lines are drawn in. Writes one text
  // per mount: the caller gives each new text its own key.
  useEffect(() => {
    let active = true
    const fontSpec = FONTS[props.font]
    const sizeList = sizesKey.split(' ').map(Number)
    if (still) onWrittenRef.current?.() // R21: no waiting on the pen
    void document.fonts
      .load(canvasFont(fontSpec, sizeList[0]))
      .catch(() => undefined) // a missing font only means Georgia; still write
      .then(() => {
        if (active && boxRef.current) setLayout(layOut(text, boxRef.current, fontSpec, sizeList, fit))
      })
    return () => {
      active = false
    }
  }, [text, still, props.font, sizesKey, fit])

  // Animate the lines and the pen. Every animation and timer is cancelled on unmount or a new text.
  useEffect(() => {
    const pen = penRef.current
    if (still || !layout || !pen) return
    const chars = layout.lines.reduce((n, l) => n + l.text.length, 0)
    const hops = layout.lines.length - 1
    // Many short lines (a long idea on a phone): the hops between lines take at most half the time.
    const hop = hops > 0 ? Math.min(HOP_MS, (maxMs - LEAD_MS) / 2 / hops) : 0
    const perChar = Math.min(MS_PER_CHAR, (maxMs - LEAD_MS - hop * hops) / Math.max(1, chars))
    const animations: Animation[] = []
    const timers: number[] = []
    const stops: { at: number; x: number; y: number }[] = []
    let t = LEAD_MS
    layout.lines.forEach((line, i) => {
      const x = center ? (layout.width - line.width) / 2 : 0
      const y = layout.top + (i + 0.8) * layout.lineHeight // on the baseline, roughly
      const duration = line.text.length * perChar
      stops.push({ at: t, x, y }, { at: t + duration, x: x + line.width, y })
      const span = lineRefs.current[i]
      if (span) {
        animations.push(
          span.animate([{ clipPath: 'inset(-25% 105% -25% -5%)' }, { clipPath: 'inset(-25% -5% -25% -5%)' }], {
            duration,
            delay: t,
            fill: 'both',
          }),
        )
      }
      timers.push(window.setTimeout(() => setNibDown(true), t), window.setTimeout(() => setNibDown(false), t + duration))
      t += duration + hop
    })
    const end = stops[stops.length - 1].at // exactly the last stop, so its offset is exactly 1
    animations.push(
      pen.animate(
        [
          { transform: `translate(${stops[0].x + 40}px, ${stops[0].y - 50}px)`, opacity: 0, offset: 0 },
          ...stops.map((s) => ({ transform: `translate(${s.x}px, ${s.y}px)`, opacity: 1, offset: Math.min(1, s.at / end) })),
        ],
        { duration: end, fill: 'forwards' },
      ),
    )
    timers.push(
      window.setTimeout(() => {
        setPhase('written')
        onWrittenRef.current?.()
      }, end),
    )
    return () => {
      animations.forEach((a) => a.cancel())
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [layout, center, maxMs, still])

  // Once written and nothing is left to wait for, the pen lifts away, then is removed.
  const leaving = phase === 'written' && !waiting
  useEffect(() => {
    if (!leaving) return
    const id = window.setTimeout(() => setPhase('gone'), LEAVE_MS)
    return () => window.clearTimeout(id)
  }, [leaving])

  const motion =
    phase === 'writing' && nibDown ? 'animate-quill-scribble' : phase === 'written' && waiting ? 'animate-quill-tap' : ''

  return (
    <div className={className}>
      <span className="sr-only">{text}</span>
      <div
        ref={boxRef}
        aria-hidden="true"
        className={`relative ${fit ? 'h-full' : ''}`}
        style={fit ? undefined : { height: layout ? layout.height : `${font.lineHeight}em` }}
      >
        {layout?.lines.map((line, i) => (
          <span
            key={`${i}-${line.text}`}
            ref={(el) => {
              lineRefs.current[i] = el
            }}
            className="absolute font-story whitespace-nowrap"
            style={{
              left: center ? (layout.width - line.width) / 2 : 0,
              top: layout.top + i * layout.lineHeight,
              fontSize: layout.size,
              lineHeight: `${layout.lineHeight}px`,
              fontStyle: font.style,
              fontWeight: font.weight,
              clipPath: still ? undefined : 'inset(-25% 105% -25% -5%)', // nothing shows until its animation starts (105%: not even an italic overhang)
            }}
          >
            {line.text}
          </span>
        ))}
        {layout && !still && phase !== 'gone' && (
          // A zero-size point at the nib; the Quill hangs from it with its tip (bottom-left) on the point.
          <div ref={penRef} className="pointer-events-none absolute top-0 left-0 z-10 size-0">
            <div
              className={`absolute bottom-0 left-0 origin-bottom-left transition-[opacity,translate] duration-500 ${
                leaving ? 'translate-x-14 -translate-y-10 opacity-0' : ''
              }`}
            >
              <div className={`origin-bottom-left ${motion}`}>
                <Quill className="w-28 drop-shadow-[6px_10px_8px_rgb(0_0_0/0.4)]" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
