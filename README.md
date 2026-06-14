# Community Support Triage Agent

A conversational AI triage agent that helps people in crisis (food, housing, mental health) find the right local support service fast. Built for the USAII Global AI Hackathon 2026.

## What it does

- **Intake agent**: asks a few targeted triage questions in natural language
- **Matching**: maps the situation to a live database of local support services (eligibility, hours, location)
- **Output**: a ranked, actionable list of services with contact info and next steps
- **Safety**: every result includes a human/211 fallback; high-risk situations trigger a human handoff
- **Insights dashboard** (stretch): aggregates anonymized queries to show where unmet need is highest

## Repo structure

```
backend/    FastAPI service (intake + matching API)
frontend/   Minimal React chat UI
.gitlab-ci.yml  Lint + test pipeline
```

## Quick start

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API docs at http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Responsible AI notes

- Resource data is human-verified and regularly audited (see `backend/app/data/resources.json`).
- Low-confidence matches are flagged explicitly.
- Immediate-danger situations (suicidal ideation, domestic violence, medical emergency) bypass automated recommendations and route to a human responder.
