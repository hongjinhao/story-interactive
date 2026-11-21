// Halloween's Quill (TH32): a gloved hand holding a dark crow quill. Shown only while the book is being
// written (SPEC-3 D11). The viewBox starts at the nib tip, so the tip is its bottom-left corner: the
// caller places that corner where the ink should go. The outlines keep it readable on the light page and
// the dark cover alike. Decorative only.
export default function Quill({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="4 -4 130 120" aria-hidden="true" className={`pointer-events-none overflow-visible ${className}`}>
      {/* shaft and feather */}
      <path d="M8 112L118 6" strokeWidth={2.4} strokeLinecap="round" className="stroke-muted" />
      <path d="M48 72C60 40 90 14 124 2C116 30 96 58 60 78Z" strokeWidth={1.4} className="fill-page-ink stroke-muted" />
      <g fill="none" strokeWidth={0.8} className="stroke-muted" opacity={0.75}>
        <path d="M58 70C78 52 96 32 118 8" />
        <path d="M70 56l-8-10M82 44l-8-11M94 32l-7-11M74 62l11 2M88 50l11 2M101 36l10 2" />
      </g>
      <path d="M4 116L13 101L19 107Z" strokeWidth={0.8} className="fill-foil stroke-page-ink" />
      {/* sleeve and glove */}
      <path d="M84 120C86 104 96 92 112 86L130 104L130 120Z" strokeWidth={1.2} className="fill-book-cover-deep stroke-muted" />
      <g strokeWidth={1.4} className="fill-muted stroke-page-ink">
        <path d="M40 92C46 80 62 76 78 82C92 88 98 98 94 108C88 118 66 118 52 112C42 108 36 100 40 92Z" />
        <path d="M26 98C24 92 30 86 38 88C46 90 50 96 46 101C42 105 30 104 26 98Z" />
        <path d="M32 90C34 82 44 78 52 82C58 86 58 92 52 96" />
      </g>
      <path d="M50 108C56 112 66 112 72 108" fill="none" strokeWidth={1.1} className="stroke-page-ink" />
    </svg>
  )
}
