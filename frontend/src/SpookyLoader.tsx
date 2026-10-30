import { useEffect, useState } from 'react'
import Ghost from './Ghost.tsx'

// SPEC: if generation takes more than 10 seconds, let the user know (the backend gives up at 30 s).
const SLOW_AFTER_MS = 10_000

type Props = { message: string }

// Full-screen overlay while a story or passage is generating. It also blocks clicks underneath,
// so a choice can't be sent twice.
export default function SpookyLoader({ message }: Props) {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/85 px-4 backdrop-blur-sm">
      <div role="status" aria-live="polite" className="flex flex-col items-center text-center">
        <Ghost className="h-24 w-20 animate-float opacity-90 motion-reduce:animate-none" />
        <p className="mt-6 font-story text-xl italic">{message}</p>
        {slow && <p className="mt-2 text-mist">The spirits are slow tonight… still working.</p>}
      </div>
    </div>
  )
}
