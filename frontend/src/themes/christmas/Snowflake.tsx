// A six-armed snowflake: each arm has a small V of branches part of the way out. Decorative only.
const ARM = 10
const BRANCH_AT = 6
const BRANCH = 3.5

function point(radius: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [radius * Math.cos(a), radius * Math.sin(a)]
}

const xy = ([x, y]: [number, number]) => `${x.toFixed(2)} ${y.toFixed(2)}`

const FLAKE = [0, 60, 120, 180, 240, 300]
  .map((deg) => {
    const base = xy(point(BRANCH_AT, deg))
    const branch = (turn: number) => `M${base}l${xy(point(BRANCH, deg + turn))}`
    return `M0 0L${xy(point(ARM, deg))}${branch(40)}${branch(-40)}`
  })
  .join('')

export default function Snowflake({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="-12 -12 24 24" aria-hidden="true" className={`pointer-events-none ${className}`}>
      <path d={FLAKE} fill="none" strokeWidth={1.5} strokeLinecap="round" className="stroke-ink" />
    </svg>
  )
}
