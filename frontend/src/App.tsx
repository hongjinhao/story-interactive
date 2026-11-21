import { useEffect, useState } from 'react'
import NewStoryForm from './NewStoryForm.tsx'
import StoryList from './StoryList.tsx'
import StoryView from './StoryView.tsx'
import ThemePicker from './ThemePicker.tsx'
import { savePick, type Theme } from './themes.ts'

type Health = { status: string }
// What the book opens with: a new idea to create (SPEC-3 D13), or a saved story's page. null = home.
type Open = null | { idea: string } | { nodeId: number }

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function App({ initialTheme }: { initialTheme: Theme }) {
  const [status, setStatus] = useState('loading')
  const [open, setOpen] = useState<Open>(null)
  const [leavingTo, setLeavingTo] = useState<Open>(null) // home is fading out before the book appears
  const [lastIdea, setLastIdea] = useState('') // refills the form after a failed create (R19)
  const [theme, setTheme] = useState(initialTheme) // main.tsx picks it (saved pick or season)

  useEffect(() => {
    fetch('/api/health')
      // 503 means the backend is up but the database isn't; its body says so
      .then((r) => (r.ok || r.status === 503 ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: Health) => setStatus(data.status))
      .catch(() => setStatus('backend unreachable'))
  }, [])

  const healthy = status === 'ok' || status === 'loading'

  // Switching theme only changes the look and which story bank is listed (R13).
  function pickTheme(next: Theme) {
    setTheme(next)
    document.documentElement.dataset.theme = next.id // the CSS variables follow
    savePick(next.id, new Date())
  }

  function openBook(next: Open) {
    if (leavingTo) return
    if (reducedMotion()) setOpen(next)
    else setLeavingTo(next) // the fade's end opens the book
  }

  function goHome(idea?: string) {
    setLastIdea(idea ?? '')
    setOpen(null)
  }

  const unreachable = !healthy && (
    <p role="alert" className="mb-6 rounded-xl border border-danger bg-surface p-4 text-danger">
      {theme.copy.unreachable} ({status}). Start the backend with <code>./dev.sh</code>, then reload.
    </p>
  )

  return (
    <div className="relative flex min-h-screen flex-col">
      <theme.Decor />
      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-16">
        {open === null ? (
          // Fades in on arrival and back from the book; fades out before the book appears.
          <div
            inert={leavingTo !== null}
            className={leavingTo ? 'animate-fade-out' : 'animate-fade-in motion-reduce:animate-none'}
            onAnimationEnd={(e) => {
              if (e.target !== e.currentTarget || !leavingTo) return
              setOpen(leavingTo)
              setLeavingTo(null)
            }}
          >
            {/* Home page only (SPEC-3 D12); the book screen has its own small title. A story always shows in
                its own bank's theme (D4), so the picker is home-only too. */}
            <header className="mb-10 text-center">
              <div className="-mt-4 mb-4 sm:-mt-8">
                <ThemePicker value={theme.id} onChange={pickTheme} />
              </div>
              <h1 className="font-display text-5xl tracking-wide text-accent sm:text-6xl">Story Interactive</h1>
              <p className="mt-3 text-lg text-muted">{theme.copy.tagline}</p>
            </header>
            {unreachable}
            <NewStoryForm theme={theme} initialIdea={lastIdea} onStart={(idea) => openBook({ idea })} />
            <StoryList key={theme.id} theme={theme} onOpen={(nodeId) => openBook({ nodeId })} />
          </div>
        ) : (
          <>
            {unreachable}
            <StoryView theme={theme} start={open} onHome={goHome} />
          </>
        )}
      </main>
    </div>
  )
}
