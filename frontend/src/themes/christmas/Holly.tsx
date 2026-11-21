// A holly sprig drawn for the bottom-right corner: two leaves reaching up and left, three berries in
// the corner. Christmas's CardCorner; FestiveDecor turns it for the page's top corners. Decorative only.

// One wavy, pointed leaf from (0,0) along +x, 36 long.
const LEAF =
  'M0 0Q6-9 12-6Q15-11 20-7Q24-11 28-6Q33-7 36 0Q33 7 28 6Q24 11 20 7Q15 11 12 6Q6 9 0 0z'

export default function Holly({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={`pointer-events-none ${className}`}>
      <g className="fill-field">
        <path d={LEAF} transform="translate(52 52) rotate(200)" />
        <path d={LEAF} transform="translate(52 52) rotate(250)" />
      </g>
      <g className="fill-holly">
        <circle cx="50" cy="47" r="4" />
        <circle cx="56" cy="51" r="4" />
        <circle cx="49" cy="55" r="4" />
      </g>
    </svg>
  )
}
