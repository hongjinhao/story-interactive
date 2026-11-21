import Cobweb from './Cobweb.tsx'

// Halloween's CardCorner: the corner cobweb turned to fit the book page's bottom-right corner, in dark
// ink so it shows on the paper. The caller positions and sizes it; decorative only.
export default function CardCobweb({ className = '' }: { className?: string }) {
  return <Cobweb className={`rotate-180 ${className}`} strokeClassName="stroke-page-ink" />
}
