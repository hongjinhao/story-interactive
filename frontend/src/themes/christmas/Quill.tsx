// Christmas's Quill (TH32): a white glove holding a red-and-white striped pen. Shown only while the book
// is being written (SPEC-3 D11). The viewBox starts at the nib tip, so the tip is its bottom-left corner:
// the caller places that corner where the ink should go. Dark outlines keep it readable on the light page,
// the snow-white glove and gold nib on the red cover. Decorative only.

// Slanted stripes along the pen body, which runs from x=16 to x=150 along the pen's own axis.
const STRIPES = Array.from({ length: 9 }, (_, i) => 24 + i * 14)
  .map((x) => `M${x} -4.5h7l-4 9h-7z`)
  .join('')

export default function Quill({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="4 -4 130 120" aria-hidden="true" className={`pointer-events-none overflow-visible ${className}`}>
      {/* the pen, drawn along +x from its nib tip, then turned to point down-left at the corner */}
      <g transform="translate(4 116) rotate(-44)">
        <rect x={16} y={-4.5} width={136} height={9} rx={2} className="fill-page" />
        <path d={STRIPES} className="fill-holly" />
        <rect x={16} y={-4.5} width={136} height={9} rx={2} fill="none" strokeWidth={1.2} className="stroke-page-ink" />
        <path d="M0 0L16-4.5V4.5Z" strokeWidth={0.8} className="fill-foil stroke-page-ink" />
      </g>
      {/* sleeve and glove */}
      <path d="M84 120C86 104 96 92 112 86L130 104L130 120Z" strokeWidth={1.2} className="fill-holly stroke-page-ink" />
      <g strokeWidth={1.4} className="fill-ink stroke-page-ink">
        <path d="M40 92C46 80 62 76 78 82C92 88 98 98 94 108C88 118 66 118 52 112C42 108 36 100 40 92Z" />
        <path d="M26 98C24 92 30 86 38 88C46 90 50 96 46 101C42 105 30 104 26 98Z" />
        <path d="M32 90C34 82 44 78 52 82C58 86 58 92 52 96" />
      </g>
      <path d="M50 108C56 112 66 112 72 108" fill="none" strokeWidth={1.1} className="stroke-page-ink" />
    </svg>
  )
}
