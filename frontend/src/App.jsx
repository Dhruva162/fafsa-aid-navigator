import { useState } from 'react'

const YEAR_OPTIONS = [
  { value: '1', label: '1st year' },
  { value: '2', label: '2nd year' },
  { value: '3', label: '3rd year' },
  { value: '4', label: '4th year' },
  { value: '5', label: '5th year or beyond' },
]

const currency = (n) =>
  typeof n === 'number'
    ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    : n

export default function App() {
  const [form, setForm] = useState({
    agi: '',
    familySize: '',
    numInCollege: '',
    yearInSchool: '1',
  })
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setResult(null)
    try {
      const resp = await fetch('/api/aid-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
  dependency_status: "dependent",
  household_agi: Number(form.agi),
  family_size: Number(form.familySize),
  number_in_college: Number(form.numInCollege),

  student_income: 0,
  student_assets: 0,
  independent_assets: 0,

  enrollment_intensity: "full_time",
  year_in_school: Number(form.yearInSchool),

  citizenship_eligible: true,
  receives_means_tested_benefit: false,

  school_type: "public_4yr_in_state",
  custom_coa: null
}),
      })
      if (!resp.ok) throw new Error(`Request failed (${resp.status})`)
      setResult(await resp.json())
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <main style={styles.container}>
        <header style={styles.header}>
          <span style={styles.eyebrow}>Federal Student Aid Estimate</span>
          <h1 style={styles.title}>FAFSA Aid Navigator</h1>
          <p style={styles.subtitle}>
            Enter a few household details to get a quick estimate of your Pell Grant,
            Work Study, and federal loan eligibility.
          </p>
        </header>

        <form onSubmit={handleSubmit} style={styles.card}>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="agi">
              Household Adjusted Gross Income (AGI)
            </label>
            <input
              id="agi"
              type="number"
              min="0"
              step="1"
              required
              value={form.agi}
              onChange={(e) => update('agi', e.target.value)}
              placeholder="e.g. 45000"
              style={styles.input}
            />
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="familySize">
                Family Size
              </label>
              <input
                id="familySize"
                type="number"
                min="1"
                step="1"
                required
                value={form.familySize}
                onChange={(e) => update('familySize', e.target.value)}
                placeholder="e.g. 4"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label} htmlFor="numInCollege">
                Number in College
              </label>
              <input
                id="numInCollege"
                type="number"
                min="1"
                step="1"
                required
                value={form.numInCollege}
                onChange={(e) => update('numInCollege', e.target.value)}
                placeholder="e.g. 1"
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="yearInSchool">
              Year in School
            </label>
            <select
              id="yearInSchool"
              value={form.yearInSchool}
              onChange={(e) => update('yearInSchool', e.target.value)}
              style={styles.input}
            >
              {YEAR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Calculating…' : 'Get my estimate'}
          </button>
        </form>

        {error && (
          <div style={styles.errorBox}>
            <strong>Couldn't get an estimate.</strong> {error}
          </div>
        )}

        {result && (
          <section style={styles.results}>
            <h2 style={styles.resultsTitle}>Your estimate</h2>
            <div style={styles.resultsGrid}>
              <div style={styles.resultCard}>
  <span style={styles.resultLabel}>Pell Grant</span>
  <span style={styles.resultValue}>
    {result.results?.pell_grant?.estimated_award_range
      ? `$${result.results.pell_grant.estimated_award_range[0].toLocaleString()}`
      : 'N/A'}
  </span>
</div>

<div style={styles.resultCard}>
  <span style={styles.resultLabel}>Work Study</span>
  <span style={styles.resultValue}>
    {result.results?.federal_work_study?.estimated_award_range
      ? `$${result.results.federal_work_study.estimated_award_range[0].toLocaleString()} - $${result.results.federal_work_study.estimated_award_range[1].toLocaleString()}`
      : 'N/A'}
  </span>
</div>

<div style={styles.resultCard}>
  <span style={styles.resultLabel}>Subsidized Loan</span>
  <span style={styles.resultValue}>
    {result.results?.subsidized_loan?.estimated_award_range
      ? `$${result.results.subsidized_loan.estimated_award_range[0].toLocaleString()}`
      : 'N/A'}
  </span>
</div>
            </div>
            {result.note && <p style={styles.note}>{result.note}</p>}
          </section>
        )}
      </main>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0F1A2B',
    color: '#EAF0F6',
    fontFamily:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '2.5rem 1.25rem',
  },
  container: {
    maxWidth: 560,
    margin: '0 auto',
  },
  header: {
    marginBottom: '1.75rem',
  },
  eyebrow: {
    display: 'inline-block',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#7FB6E8',
    marginBottom: '0.5rem',
  },
  title: {
    margin: 0,
    fontSize: '2rem',
    fontWeight: 700,
    letterSpacing: '-0.01em',
  },
  subtitle: {
    marginTop: '0.5rem',
    color: '#9FB2C7',
    lineHeight: 1.5,
    fontSize: '0.95rem',
  },
  card: {
    background: '#16243B',
    border: '1px solid #243758',
    borderRadius: 12,
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  row: {
    display: 'flex',
    gap: '1rem',
  },
  field: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#C8D6E5',
  },
  input: {
    padding: '0.6rem 0.7rem',
    borderRadius: 8,
    border: '1px solid #2E436A',
    background: '#0F1A2B',
    color: '#EAF0F6',
    fontSize: '0.95rem',
    outline: 'none',
  },
  button: {
    marginTop: '0.5rem',
    padding: '0.75rem 1rem',
    borderRadius: 8,
    border: 'none',
    background: '#4C8BF5',
    color: '#0F1A2B',
    fontWeight: 700,
    fontSize: '0.95rem',
    cursor: 'pointer',
  },
  errorBox: {
    marginTop: '1rem',
    background: '#3A1B23',
    border: '1px solid #6B2A38',
    color: '#F4C5CE',
    borderRadius: 8,
    padding: '0.85rem 1rem',
    fontSize: '0.9rem',
  },
  results: {
    marginTop: '1.75rem',
  },
  resultsTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    marginBottom: '0.75rem',
  },
  resultsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.75rem',
  },
  resultCard: {
    background: '#16243B',
    border: '1px solid #243758',
    borderRadius: 10,
    padding: '1rem 0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    alignItems: 'flex-start',
  },
  resultLabel: {
    fontSize: '0.78rem',
    color: '#9FB2C7',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  resultValue: {
    fontSize: '1.35rem',
    fontWeight: 700,
    color: '#7FE0A5',
  },
  note: {
    marginTop: '1rem',
    color: '#9FB2C7',
    fontSize: '0.9rem',
    lineHeight: 1.5,
  },
}