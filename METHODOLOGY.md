# Aid Navigator — Eligibility Engine Methodology

This document explains how `eligibility.py` works, what real federal rules it
is based on, and where it deliberately simplifies. It's written to be reused
directly in the Devpost "AI Architecture Explanation" and "Data Disclosure"
fields.

## 1. What this engine does

Given a small set of household/student facts (collected conversationally),
the engine:

1. Approximates a **Student Aid Index (SAI)** — the number the real FAFSA
   produces and that all federal need-based aid is keyed off of.
2. Matches that SAI (plus enrollment details) against published 2026-27
   thresholds for:
   - **Federal Pell Grant**
   - **Federal Work-Study**
   - **Direct Subsidized / Unsubsidized Loans**
3. Returns a structured result with "may qualify" framing, an estimated
   range (never a single guaranteed number), the reasoning behind each
   result, and concrete next steps.

This structured JSON is the **input to the LLM explanation layer** — the LLM's
job is only to phrase this reasoning conversationally, not to invent numbers.
That separation (rules engine decides, LLM explains) is the core "AI
reasoning, not just generation" design choice judges asked about.

## 2. Real data sources (2026-27 award year)

- Pell Grant maximum ($7,395), minimum ($740), and SAI eligibility cutoff
  ($14,790, per the One Big Beautiful Bill Act's "2x max award" rule) —
  Federal Student Aid Dear Colleague Letter GEN-26-01 (Jan 30, 2026).
- SAI range (-1,500 to 999,999) and "Auto-Zero" pathway for households
  receiving SNAP/Medicaid/TANF/WIC/SSI/free-or-reduced lunch — Federal
  Student Aid SAI & Pell Grant Eligibility Guide.
- Federal Work-Study eligibility criteria (FAFSA interest flag, demonstrated
  financial need, at least half-time enrollment, citizenship) —
  studentaid.gov "8 Things You Should Know About Federal Work-Study."
- Direct Subsidized/Unsubsidized annual and aggregate loan limits by year in
  school and dependency status — FSA Handbook Vol. 8, Ch. 4 (Annual and
  Aggregate Loan Limits).
- SAI formula structure (income protection allowances, employment expense
  allowance, payroll tax allowance, progressive 22%–47% assessment on
  available income, student income/asset assessment rates) — FSA SAI Guide
  and FSA Federal Register notice on the Federal Need Analysis Methodology.

## 3. Where we simplified (and why)

Real SAI calculation involves dozens of inputs (separate parent/student
worksheets, state-specific tax tables, asset protection allowances, etc.)
that would take weeks to replicate exactly — and the official FAFSA already
exists for that. Our goal is **transparent, directionally-correct reasoning**
that a student can use to understand *why* they might qualify for something,
not to replace the FAFSA.

Specific simplifications:

- **Income Protection Allowance table**: we derive a single IPA per family
  size as ~144% of the federal poverty line (this matches the published
  family-of-4 figure of $44,880). The real table varies slightly by exact
  household composition.
- **Available income assessment**: we use a 6-bracket progressive table
  (22%–47%) as a stand-in for the official multi-step worksheet, which
  produces materially similar results for most households.
- **Payroll tax allowance**: approximated as a flat 7.65% of AGI rather than
  the exact bracketed table.
- **Pell award between $0 and the SAI cutoff**: the real award table is a
  lookup table; we use linear interpolation, then present a **±15% range**
  rather than a single number to avoid false precision.
- **Federal Work-Study award size**: real awards depend entirely on each
  school's FWS fund allocation, which we have no way to know. We only assess
  *eligibility*, and label the award estimate "low confidence."
- **Cost of Attendance**: defaults to national-average estimates by school
  type unless the user provides their own school's COA.

Every one of these is recorded in `data/aid_programs.json` under
`disclaimer` and the relevant section's `notes` field, so the data layer
itself documents its own limitations.

## 4. Responsible AI summary (for Devpost)

- **Risk**: A student could treat an estimated award as guaranteed, or the
  underlying federal thresholds could become outdated as rules change
  annually (as they did for 2026-27 under the OBBB Act).
- **Mitigation**: Every result uses "may qualify" language and a *range*,
  never a guaranteed dollar amount. The data file carries an explicit
  `award_year` and `last_updated` field, and every response includes the
  disclaimer text plus a pointer to the real FAFSA at fafsa.gov.
- **Human-in-the-loop**: The engine never issues a final eligibility
  determination or award letter. That is explicitly reserved for the
  school's financial aid office after the real FAFSA is reviewed — see
  `human_referral` in every response.

## 5. Data freshness

All thresholds are tagged with `award_year: "2026-27"` and
`last_updated: "2026-06-14"` in `data/aid_programs.json`. In a production
version, this file would be refreshed whenever Federal Student Aid publishes
updated Dear Colleague Letters (typically each January/February for the
following award year).
