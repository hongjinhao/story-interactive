import { useEffect, useState } from 'react'

export default function App() {
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('backend unreachable'))
  }, [])

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Fullstack Starter</h1>
      <p>Backend status: <strong>{status}</strong></p>
    </main>
  )
}
