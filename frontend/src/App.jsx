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
  dependencyStatus: 'dependent',
})
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [situation, setSituation] = useState('')
  const [extracted, setExtracted] = useState(null)
  const [confirmed, setConfirmed] = useState(false)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }
  async function analyzeSituation() {
  try {
    const resp = await fetch(
      'http://127.0.0.1:8000/api/extract-profile',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          situation
        })
      }
    )

    const data = await resp.json()

    setConfirmed(false)
    setExtracted(data)

  } catch (err) {
    alert("Could not analyze situation.")
  }
} 

  async function calculateEstimate() {
    setError(null)
    setLoading(true)
    setResult(null)

    try {
      const resp = await fetch(
        'http://127.0.0.1:8000/api/aid-estimate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dependency_status: form.dependencyStatus,
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
          })
        }
      )

      setResult(await resp.json())

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    calculateEstimate()
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

<div style={styles.card}>
  <h3>Describe Your Situation</h3>

  <textarea
    rows="5"
    value={situation}
    onChange={(e) => setSituation(e.target.value)}
    placeholder="My parents earn about $45,000. We are a family of 4. My sister is also in college. I'm a first-year student."
    style={styles.input}
  />

  <button
    type="button"
    style={styles.button}
    onClick={analyzeSituation}
  >
    Analyze My Situation
  </button>
</div>

{extracted && !confirmed &&  (
  <div style={styles.card}>
    <h3>Here's What I Understood</h3>

    <p>Income: ${extracted.household_agi}</p>
    <p>Family Size: {extracted.family_size}</p>
    <p>Students In College: {extracted.number_in_college}</p>
    <p>Year In School: {extracted.year_in_school}</p>
    <p>Status: {extracted.dependency_status}</p>
    <p>AI Confidence: {extracted.confidence || 'N/A'}</p>

    {extracted.missing_fields?.length > 0 && (
      <div style={styles.missingBox}>
        <strong>Missing Information</strong>
        <ul style={styles.missingList}>
          {extracted.missing_fields.map((field) => (
            <li key={field}>{field}</li>
          ))}
        </ul>
      </div>
    )}

<button
  type="button"
  style={styles.button}
  disabled={extracted.missing_fields?.length > 0}
  onClick={() => {
    setForm({
      agi: String(extracted.household_agi),
      familySize: String(extracted.family_size),
      numInCollege: String(extracted.number_in_college),
      yearInSchool: String(extracted.year_in_school),
      dependencyStatus: extracted.dependency_status,
    })

    setConfirmed(true)

    setTimeout(() => {
      calculateEstimate()
    }, 100)
  }}
>
      {extracted.missing_fields?.length > 0
        ? 'Please provide missing information'
        : 'Confirm & Populate Form'}
    </button>

    <div style={styles.demoBox}>
      <strong>Example:</strong>
      <pre style={styles.demoText}>
"My parents earn $45,000.
We are a family of 4.
My sister is also in college.
I am a first-year dependent student."
      </pre>
    </div>
  </div>
)}


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
              <div style={styles.field}>
  <label style={styles.label}>
    Student Type
  </label>

  <select
    value={form.dependencyStatus}
    onChange={(e) => update('dependencyStatus', e.target.value)}
    style={styles.input}
  >
    <option value="dependent">Dependent Student</option>
    <option value="independent">Independent Student</option>
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
  <span style={styles.resultLabel}>Estimated SAI</span>
  <span style={styles.resultValue}>
    {Math.round(result.sai_estimate)}
  </span>
</div>
             <div style={styles.resultCard}>
  <span style={styles.resultLabel}>Pell Grant</span>

  <small>
    Confidence: {result.results?.pell_grant?.confidence}
  </small>

  <span style={styles.resultValue}>
    {result.results?.pell_grant?.estimated_award_range
      ? `$${result.results.pell_grant.estimated_award_range[0].toLocaleString()}`
      : 'N/A'}
  </span>
</div>

<div style={styles.resultCard}>
  <span style={styles.resultLabel}>Work Study</span>
  <small>
  Confidence: {result.results?.federal_work_study?.confidence}
</small>
  <span style={styles.resultValue}>
    {result.results?.federal_work_study?.estimated_award_range
      ? `$${result.results.federal_work_study.estimated_award_range[0].toLocaleString()} - $${result.results.federal_work_study.estimated_award_range[1].toLocaleString()}`
      : 'N/A'}
  </span>
</div>

<div style={styles.resultCard}>
  <span style={styles.resultLabel}>Subsidized Loan</span>
  <small>
  Confidence: {result.results?.subsidized_loan?.confidence}
</small>
  <span style={styles.resultValue}>
    {result.results?.subsidized_loan?.estimated_award_range
      ? `$${result.results.subsidized_loan.estimated_award_range[0].toLocaleString()}`
      : 'N/A'}
  </span>
</div>
            </div>
            <div style={styles.warningBox}>
  <strong>Important:</strong>
  This tool provides estimates only.
  Final eligibility is determined by FAFSA
  and your school's financial aid office.
</div>
           {result.ai_explanation && (
  <div style={styles.aiCard}>
    <h3>AI Financial Aid Advisor</h3>
    <div style={{ whiteSpace: 'pre-wrap' }}>
  {result.ai_explanation}
</div>
  </div>
)}
<div style={styles.aiCard}>
  <h3>Recommended Next Steps</h3>

  <ol>
    {result.next_steps?.map((step, idx) => (
      <li key={idx}>{step}</li>
    ))}
  </ol>
</div>

<div style={styles.warningBox}>
  <h3>Human Review Required</h3>

  <p>{result.human_referral}</p>
</div>

<div style={styles.aiCard}>
  <h3>How Your SAI Was Estimated</h3>

  <ul>
    {result.sai_explanation?.map((item, idx) => (
      <li key={idx}>{item}</li>
    ))}
  </ul>
</div>
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
  missingBox: {
    background: '#2E2E3F',
    border: '1px solid #4A5B7C',
    borderRadius: 10,
    padding: '0.85rem 1rem',
  },
  missingList: {
    margin: '0.5rem 0 0',
    paddingLeft: '1rem',
  },
  demoBox: {
    background: '#111B2F',
    border: '1px dashed #4C8BF5',
    borderRadius: 10,
    padding: '0.85rem 1rem',
    marginTop: '1rem',
    color: '#C7D7F5',
    fontSize: '0.95rem',
  },
  demoText: {
    whiteSpace: 'pre-wrap',
    margin: '0.5rem 0 0',
    color: '#EAF0F6',
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
    gridTemplateColumns: 'repeat(2, 1fr)',
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
  aiCard: {
  marginTop: '1rem',
  background: '#16243B',
  border: '1px solid #243758',
  borderRadius: 10,
  padding: '1rem',
  lineHeight: 1.6,
},
warningBox: {
  marginTop: '1rem',
  background: '#332500',
  border: '1px solid #8B6A00',
  padding: '1rem',
  borderRadius: 8,
  color: '#FFE7A3',
},
  note: {
    marginTop: '1rem',
    color: '#9FB2C7',
    fontSize: '0.9rem',
    lineHeight: 1.5,
  },
}