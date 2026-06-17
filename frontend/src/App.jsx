import { useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL;
console.log("API_URL =", API_URL);

const YEAR_OPTIONS = [
  { value: '1', label: '1st year' },
  { value: '2', label: '2nd year' },
  { value: '3', label: '3rd year' },
  { value: '4', label: '4th year' },
  { value: '5', label: '5th year or beyond' },
]

const FIELD_LABELS = {
  household_agi: 'Household Income (AGI)',
  family_size: 'Family Size',
  number_in_college: 'Number of Students in College',
  year_in_school: 'Year in School',
  dependency_status: 'Dependency Status',
}

const normalizeYear = (value) => {
  if (!value) return '1';

  const text = String(value).toLowerCase();

  if (text.includes('1')) return '1';
  if (text.includes('2')) return '2';
  if (text.includes('3')) return '3';
  if (text.includes('4')) return '4';
  if (text.includes('5')) return '5';

  return '1';
};

const normalizeDependencyStatus = (value) => {
  if (!value) return 'dependent';

  const text = String(value).toLowerCase();

  return text.includes('independent')
    ? 'independent'
    : 'dependent';
};

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
  const [followupAnswer, setFollowupAnswer] = useState('')
  const [followupLoading, setFollowupLoading] = useState(false)
  const [showManualForm, setShowManualForm] = useState(false)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }
  async function analyzeSituation() {
  try {
    const resp = await fetch(
      `${API_URL}/api/extract-profile`,
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

    if (data?.error) {
      alert(
        "We couldn't identify FAFSA-related information.\n\nPlease describe:\n• Household income\n• Family size\n• Students in college\n• Dependency status"
      )
      return
    }

    setConfirmed(false)
    setExtracted(data)
    setShowManualForm(true)
    setResult(null)

  } catch (err) {
    alert("Could not analyze situation.")
  }
}

async function submitFollowup() {
  try {
    setFollowupLoading(true)

    const resp = await fetch(
      `${API_URL}/api/followup`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          current_profile: extracted,
          answer: followupAnswer
        })
      }
    )

    const data = await resp.json()
    console.log("FOLLOWUP RESPONSE:", data)

    setExtracted(data)
    setFollowupAnswer('')

  } catch (err) {
    alert('Could not update profile.')
  } finally {
    setFollowupLoading(false)
  }
}

  async function calculateEstimate() {
    setError(null)
    setLoading(true)
    setResult(null)

    try {
      const yearMap = {
        "1st year": 1,
        "2nd year": 2,
        "3rd year": 3,
        "4th year": 4,
        "5th year or beyond": 5,
      };

      const payload = {
        dependency_status: form.dependencyStatus,
        household_agi: Number(form.agi),
        family_size: Number(form.familySize),
        number_in_college: Number(form.numInCollege),

        student_income: 0,
        student_assets: 0,
        independent_assets: 0,

        enrollment_intensity: "full_time",

        year_in_school: parseInt(
          form.yearInSchool,
          10
        ),

        citizenship_eligible: true,
        receives_means_tested_benefit: false,

        school_type: "public_4yr_in_state",
        custom_coa: null,
      };

      console.log("PAYLOAD:", payload);
      const resp = await fetch(
        `${API_URL}/api/aid-estimate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      if (!resp.ok) {
        const err = await resp.json();

        console.error(err);

        setError(
          err.detail?.[0]?.msg ||
          "Unable to generate estimate."
        );

        setLoading(false);
        return;
      }

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
  <h3>AI-Assisted Intake (Recommended)</h3>

  <p style={styles.note}>
    Describe your situation in plain English. The AI will extract FAFSA information, identify missing details, and guide you through the process before generating an estimate.
  </p>

  <p style={styles.note}>
    AI is used only for information extraction and guidance. Financial aid calculations are performed by a deterministic eligibility engine.
  </p>

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
    <h3>Step 1: Review Extracted Information</h3>

    <p>Income: ${extracted.household_agi}</p>
    <p>Family Size: {extracted.family_size}</p>
    <p>Students In College: {extracted.number_in_college}</p>
    <p>Year In School: {extracted.year_in_school}</p>
    <p>Status: {extracted.dependency_status}</p>
    <p>
      {extracted.confidence === 'high'
        ? '🟢 High Confidence'
        : extracted.confidence === 'medium'
        ? '🟡 Medium Confidence'
        : '🔴 Low Confidence'}
    </p>

    {extracted.confidence === 'low' && (
      <p style={styles.note}>
        Please provide additional information for a more reliable estimate.
      </p>
    )}

    {extracted.missing_fields?.length > 0 && (
      <div style={styles.missingBox}>
        <strong>⚠ Missing {extracted.missing_fields.length} Required Fields</strong>
        <ul style={styles.missingList}>
          {extracted.missing_fields.map((field) => (
            <li key={field}>{field.split('_').join(' ')}</li>
          ))}
        </ul>
      </div>
    )}

    {extracted.missing_fields?.length > 0 && (
      <>
        <textarea
          rows="4"
          value={followupAnswer}
          onChange={(e) => setFollowupAnswer(e.target.value)}
          placeholder="We are a family of 4. Two people are in college. I am a dependent student."
          style={{
            ...styles.input,
            marginTop: '1rem'
          }}
        />

        <button
          type="button"
          style={styles.button}
          onClick={submitFollowup}
          disabled={followupLoading || !followupAnswer.trim()}
        >
          {followupLoading
            ? 'Updating...'
            : 'Update Profile'}
        </button>
      </>
    )}

    <button
      type="button"
      style={styles.button}
      onClick={() => {
        setForm({
          agi: extracted.household_agi ?? '',
          familySize: extracted.family_size ?? '',
          numInCollege: extracted.number_in_college ?? '',

          yearInSchool: normalizeYear(
            extracted.year_in_school
          ),

          dependencyStatus: normalizeDependencyStatus(
            extracted.dependency_status
          ),
        })

        setResult(null)
        setConfirmed(true)

      }}
    >
      Confirm & Continue
    </button>
  </div>
)}


        {!showManualForm && !extracted && (
          <div style={styles.card}>
            <div style={styles.infoBox}>Prefer traditional form entry?</div>
            <button
              type="button"
              style={styles.button}
              onClick={() => setShowManualForm(true)}
            >
              Enter Information Manually
            </button>
          </div>
        )}

        {showManualForm && (
        <form onSubmit={handleSubmit} style={styles.card}>
          <h3>Step 2: Confirm or Edit Information</h3>
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
{(
                !form.agi ||
                !form.familySize ||
                !form.numInCollege ||
                !form.dependencyStatus
              ) && (
                <div style={styles.infoBox}>
                  Please complete all required fields before generating an estimate.
                </div>
              )}

              <button
                type="submit"
                disabled={
                  loading ||
                  !form.agi ||
                  !form.familySize ||
                  !form.numInCollege ||
                  !form.dependencyStatus
                }
                style={styles.button}
              >
            {loading ? 'Calculating…' : 'Generate Aid Estimate'}
          </button>
        </form>
        )}

        {error && (
          <div style={styles.errorBox}>
            <strong>Couldn't get an estimate.</strong> {error}
          </div>
        )}

        {result && (
          <section style={styles.results}>
            <h2 style={styles.resultsTitle}>Your estimate</h2>

            <p style={styles.note}>
              AI is used for information extraction and explanations. All financial aid calculations are performed using a deterministic eligibility engine.
            </p>

            <div style={styles.resultsGrid}>
              <div style={styles.resultCard}>
  <span style={styles.resultLabel}>Estimated SAI</span>
  <span style={styles.resultValue}>
    {Number.isFinite(result?.sai_estimate)
      ? Math.round(result.sai_estimate)
      : "Unavailable"}
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
      : 'Unavailable'}
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
      : 'Unavailable'}
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
      : 'Unavailable'}
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
  infoBox: {
    marginTop: '0.75rem',
    padding: '0.85rem 1rem',
    borderRadius: 10,
    background: '#2A2F42',
    color: '#E8F1FF',
    border: '1px solid #4C7FE8',
    fontSize: '0.95rem',
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