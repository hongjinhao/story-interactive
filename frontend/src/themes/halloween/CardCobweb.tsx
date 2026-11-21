import Cobweb from './Cobweb.tsx'

// Halloween's CardCorner: the corner cobweb turned to fit the story card's bottom-right corner.
// The caller positions and sizes it; decorative only.
export default function CardCobweb({ className = '' }: { className?: string }) {
  return <Cobweb className={`rotate-180 ${className}`} />
}
