// A corner cobweb for the top-left corner (flip it with -scale-x-100 for the right). Decorative only.
// Threads fan out from the corner (0,0); rings join them, sagging back towards the corner.
const SPAN = 160
const ANGLES = [0, 18, 36, 54, 72, 90].map((deg) => (deg * Math.PI) / 180)
const RINGS = [28, 56, 86, 118, 150]

function at(radius: number, angle: number): string {
  return `${(radius * Math.cos(angle)).toFixed(1)} ${(radius * Math.sin(angle)).toFixed(1)}`
}

const threads = ANGLES.map((a) => `M0 0L${at(SPAN, a)}`).join('')
const rings = RINGS.map(
  (r) =>
    `M${at(r, ANGLES[0])}` +
    ANGLES.slice(1)
      .map((a, i) => `Q${at(r * 0.82, (ANGLES[i] + a) / 2)} ${at(r, a)}`)
      .join(''),
).join('')
const WEB = threads + rings

type Props = { className?: string }

export default function Cobweb({ className = '' }: Props) {
  return (
    <svg viewBox={`0 0 ${SPAN} ${SPAN}`} aria-hidden="true" className={`pointer-events-none ${className}`}>
      <path d={WEB} fill="none" strokeWidth={1} strokeLinecap="round" className="stroke-bone" />
    </svg>
  )
}
