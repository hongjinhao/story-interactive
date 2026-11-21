// Halloween's picker icon: a flat one-colour pumpkin silhouette (theme-specs TH18). Three overlapping
// lobes leave shallow rib notches top and bottom; a short curved stem. No face, no outline.
export default function Pumpkin({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`fill-current ${className}`}>
      <ellipse cx="7.8" cy="14.6" rx="5.3" ry="6.9" />
      <ellipse cx="16.2" cy="14.6" rx="5.3" ry="6.9" />
      <ellipse cx="12" cy="14.4" rx="4.6" ry="7.6" />
      <path d="M11.1 7.4c-.1-2 .7-3.7 2.4-4.6l.9 1.3c-1.2.7-1.6 1.8-1.5 3.3z" />
    </svg>
  )
}
