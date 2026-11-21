import { useEffect, useState } from 'react'
import NewStoryForm from './NewStoryForm.tsx'
import StoryList from './StoryList.tsx'
import StoryView from './StoryView.tsx'
import { seasonalTheme } from './themes.ts'

type Health = { status: string }

export default function App() {
  const [status, setStatus] = useState('loading')
  const [nodeId, setNodeId] = useState<number | null>(null) // null = home
  const [theme] = useState(() => seasonalTheme(new Date())) // PLAN-2 Step 7 adds the picker

  useEffect(() => {
    fetch('/api/health')
      // 503 means the backend is up but the database isn't; its body says so
      .then((r) => (r.ok || r.status === 503 ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: Health) => setStatus(data.status))
      .catch(() => setStatus('backend unreachable'))
  }, [])

  const healthy = status === 'ok' || status === 'loading'

  return (
    <div className="relative flex min-h-screen flex-col">
      <theme.Decor />
      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-16">
        <header className="mb-10 text-center">
          <h1 className="font-display text-5xl tracking-wide text-accent sm:text-6xl">Story Interactive</h1>
          <p className="mt-3 text-lg text-muted">{theme.copy.tagline}</p>
        </header>

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
          <StoryView theme={theme} nodeId={nodeId} onNavigate={setNodeId} onHome={() => setNodeId(null)} />
        )}
      </main>

      <footer className="relative z-10 pb-6 text-center text-sm text-muted">
        Backend: <span className={healthy ? 'text-success' : 'text-danger'}>{status}</span>
      </footer>
    </div>
  )
}
