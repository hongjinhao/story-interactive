// A small sheet ghost, drawn inline so it takes its colour from the theme. Decorative only.
type Props = { className?: string }

export default function Ghost({ className = '' }: Props) {
  return (
    <svg viewBox="0 0 64 80" aria-hidden="true" className={`pointer-events-none ${className}`}>
      {/* round head, then a wavy hem from right to left */}
      <path d="M8 32a24 24 0 0 1 48 0v40l-8-6-8 6-8-6-8 6-8-6-8 6z" className="fill-bone" />
      <ellipse cx="24" cy="34" rx="4" ry="6" className="fill-night" />
      <ellipse cx="40" cy="34" rx="4" ry="6" className="fill-night" />
      <ellipse cx="32" cy="48" rx="3" ry="4" className="fill-night" />
    </svg>
  )
}
