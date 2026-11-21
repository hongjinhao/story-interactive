// A round bauble with a cap, a hanging loop and one holly-red stripe. Christmas's Icon (loader, and
// peeking over the story card). Same 64×80 box as the Halloween ghost so callers size them alike.
export default function Bauble({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 80" aria-hidden="true" className={`pointer-events-none ${className}`}>
      <circle cx="32" cy="8" r="5" fill="none" strokeWidth={2.5} className="stroke-muted" />
      <rect x="25" y="12" width="14" height="10" rx="2" className="fill-muted" />
      <circle cx="32" cy="50" r="26" className="fill-accent" />
      {/* the stripe: the part of the ball between y 44 and 54 */}
      <path d="M6.7 44H57.3A26 26 0 0 1 57.69 54H6.31A26 26 0 0 1 6.7 44z" className="fill-holly" />
      <ellipse cx="22" cy="36" rx="5" ry="7" transform="rotate(35 22 36)" className="fill-ink opacity-40" />
    </svg>
  )
}
