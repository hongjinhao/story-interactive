import { useEffect, useState } from 'react'

type Health = { status: string }

export default function App() {
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    fetch('/api/health')
      // 503 means the backend is up but the database isn't; its body says so
      .then((r) => (r.ok || r.status === 503 ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: Health) => setStatus(data.status))
      .catch(() => setStatus('backend unreachable'))
  }, [])

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Fullstack Starter</h1>
      <p>Backend status: <strong>{status}</strong></p>
    </main>
  )
}
