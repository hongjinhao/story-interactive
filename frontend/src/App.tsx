import { useEffect, useState } from 'react'
import NewStoryForm from './NewStoryForm.tsx'
import StoryList from './StoryList.tsx'

type Health = { status: string }

export default function App() {
  const [status, setStatus] = useState('loading')
  const [nodeId, setNodeId] = useState<number | null>(null) // null = home

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
      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-16">
        <header className="mb-10 text-center">
          <h1 className="font-spooky text-5xl tracking-wide text-pumpkin sm:text-6xl">Story Interactive</h1>
          <p className="mt-3 text-lg text-mist">Choose your own adventure… if you dare.</p>
        </header>

        {!healthy && (
          <p role="alert" className="mb-6 rounded-xl border border-blood bg-crypt p-4 text-blood">
            The spirits can't be reached ({status}). Start the backend with <code>./dev.sh</code>, then reload.
          </p>
        )}

        {nodeId === null ? (
          <>
            <NewStoryForm onOpen={setNodeId} />
            <StoryList onOpen={setNodeId} />
          </>
        ) : (
          // Placeholder until StoryView (step 4g)
          <section className="rounded-2xl border border-crypt-edge bg-crypt p-5 sm:p-8">
            <p>Your tale has begun (node {nodeId}). The story view arrives in step 4g.</p>
            <button
              type="button"
              onClick={() => setNodeId(null)}
              className="mt-4 min-h-11 rounded-xl border-2 border-tomb px-5 font-semibold hover:border-pumpkin focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pumpkin"
            >
              Back to home
            </button>
          </section>
        )}
      </main>

      <footer className="relative z-10 pb-6 text-center text-sm text-mist">
        Backend: <span className={healthy ? 'text-slime' : 'text-blood'}>{status}</span>
      </footer>
    </div>
  )
}
