import { useEffect, useState, type ComponentType } from 'react'

// SPEC: if generation takes more than 10 seconds, let the user know (the backend gives up at 30 s).
const SLOW_AFTER_MS = 10_000

type Props = {
  message: string
  slowMessage: string
  Icon: ComponentType<{ className?: string }> // the theme's icon (ghost, bauble, ...)
}

// Full-screen overlay while a story or passage is generating. It also blocks clicks underneath,
// so a choice can't be sent twice.
export default function ThemedLoader({ message, slowMessage, Icon }: Props) {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 px-4 backdrop-blur-sm">
      <div role="status" aria-live="polite" className="flex flex-col items-center text-center">
        <Icon className="h-24 w-20 animate-float opacity-90 motion-reduce:animate-none" />
        <p className="mt-6 font-story text-xl italic">{message}</p>
        {slow && <p className="mt-2 text-muted">{slowMessage}</p>}
      </div>
    </div>
  )
}
