import { useEffect, useState } from 'react'
import NewStoryForm from './NewStoryForm.tsx'
import StoryList from './StoryList.tsx'
import StoryView from './StoryView.tsx'
import ThemePicker from './ThemePicker.tsx'
import { savePick, type Theme } from './themes.ts'

type Health = { status: string }

export default function App({ initialTheme }: { initialTheme: Theme }) {
  const [status, setStatus] = useState('loading')
  const [nodeId, setNodeId] = useState<number | null>(null) // the page the book opens on; null = home
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

  return (
    <div className="relative flex min-h-screen flex-col">
      <theme.Decor />
      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-16">
        {/* Home page only (SPEC-3 D12); the book screen has its own small title. A story always shows in
            its own bank's theme (D4), so the picker is home-only too. */}
        {nodeId === null && (
          <header className="mb-10 text-center">
            <div className="-mt-4 mb-4 sm:-mt-8">
              <ThemePicker value={theme.id} onChange={pickTheme} />
            </div>
            <h1 className="font-display text-5xl tracking-wide text-accent sm:text-6xl">Story Interactive</h1>
            <p className="mt-3 text-lg text-muted">{theme.copy.tagline}</p>
          </header>
        )}

        {!healthy && (
          <p role="alert" className="mb-6 rounded-xl border border-danger bg-surface p-4 text-danger">
            {theme.copy.unreachable} ({status}). Start the backend with <code>./dev.sh</code>, then reload.
          </p>
        )}

        {nodeId === null ? (
          <>
            <NewStoryForm theme={theme} onOpen={setNodeId} />
            <StoryList key={theme.id} theme={theme} onOpen={setNodeId} />
          </>
        ) : (
          <StoryView theme={theme} nodeId={nodeId} onHome={() => setNodeId(null)} />
        )}
      </main>
    </div>
  )
}
