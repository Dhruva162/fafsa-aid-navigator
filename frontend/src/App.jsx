import { useState } from 'react'

export default function App() {
  const [message, setMessage] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!message.trim()) return
    setLoading(true)
    try {
      const resp = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      setResult(await resp.json())
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '2rem auto', fontFamily: 'system-ui' }}>
      <h1>Find Support Near You</h1>
      <p>Tell us what's going on. We'll point you to help.</p>
      <form onSubmit={handleSubmit}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          style={{ width: '100%', padding: 8 }}
          placeholder="e.g. I lost my job and have no food for my kids"
        />
        <button type="submit" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? 'Searching...' : 'Get help'}
        </button>
      </form>

      {result && (
        <section style={{ marginTop: 24 }}>
          {result.urgent_handoff && (
            <div style={{ background: '#fee', padding: 12, borderRadius: 8 }}>
              <strong>This looks urgent.</strong> Please reach a person right now.
            </div>
          )}
          {result.matches.map((m) => (
            <article key={m.name} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginTop: 12 }}>
              <h3 style={{ margin: 0 }}>{m.name}</h3>
              <p>{m.description}</p>
              <p><strong>Call:</strong> {m.contact} &nbsp; <strong>Hours:</strong> {m.hours}</p>
              <p><em>{m.eligibility}</em></p>
            </article>
          ))}
          <p style={{ marginTop: 16, color: '#555' }}>{result.fallback}</p>
        </section>
      )}
    </main>
  )
}
