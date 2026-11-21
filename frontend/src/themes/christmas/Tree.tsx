// Christmas's picker icon: a flat one-colour tree silhouette (theme-specs TH18). Three stacked tiers
// getting wider downwards and a small trunk. No star, baubles or outline.
export default function Tree({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`fill-current ${className}`}>
      <path d="M12 1.5 17.2 8.2h-2.4l4.4 5.8h-2.9l5 6.5H2.7l5-6.5H4.8l4.4-5.8H6.8zM10.4 20.5h3.2V23h-3.2z" />
    </svg>
  )
}
