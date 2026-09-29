# Kargo Hiring — rubric-ranked CV shortlisting

Arjun uploads CVs, and the app ranks every candidate against **Kargo PM & Senior PM Shortlisting Rubric v3**, explains why, and drafts the emails. Arjun makes the call with one Yes/No pop-up. Resend delivers the interview invite (with the Google Meet link, time and a calendar file) or a polite decline. After an interview he logs his interview brief, and the score is adjusted the way the rubric says.

## Flow

1. **Upload** PDF/DOCX/TXT CVs and pick the role applied for (PM or Senior PM).
2. **Extract** (Gemini): name, email, phone and location are split from the CV content. Every later AI call sees only the redacted CV.
3. **Score** (Gemini, run twice, once for PM and once for Senior PM): gates G1–G4 and variables V1–V9, each with CV evidence and a confidence level. Weighted totals, path (A/B/C), decision, tie-breaks and the Senior PM re-screen are **computed in code** (`src/lib/rubric.ts`), not by the model.
4. **Brief & drafts** (Gemini): a 3-sentence interview brief, a "why ranked here" line, an invite draft and a decline draft.
5. **Dashboard**: candidates are ranked into *Recommended*, *On hold* and *Not shortlisted*, with scores, path, archetype, tenure/red flags, probes and reply time limits.
6. **Decide**: Invite or Decline opens a confirmation pop-up. It shows the rubric's reasoning, warns when Arjun is overriding it (a reason is required and logged), and lets him edit the email and set the date, time and Meet link. **Yes** sends through Resend and records the decision in Neon.
7. **Interview brief**: Arjun marks each probe Strong / Weak / Not asked, rates the candidate, picks an outcome and writes notes. Each weak answer lowers that variable by 1, and the post-interview score is stored next to the CV score.

## Stack

Next.js 16 (App Router) · Neon Postgres (`@neondatabase/serverless`) · Gemini `gemini-3.8-flash` via REST · Resend · Vercel.

## Environment variables

See `.env.example`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon connection string. Tables are created automatically on first request. |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_BASE_URL` | Gemini API. |
| `RESEND_API_KEY` | Resend API key. |
| `EMAIL_FROM` | Sender. Use `onboarding@resend.dev` until a domain is verified in Resend. |
| `EMAIL_OVERRIDE_TO` | Testing: redirect every email to this inbox. Clear it to email real candidates. |
| `DASHBOARD_PASSWORD`, `AUTH_SECRET` | Dashboard login. |

## Database tables

`candidates` (decision record, both evaluations, drafts, stage, Arjun's decision and reason, interview slot and feedback, email log) · `cv_files` (original upload) · `events` (audit trail) · `settings` · `rubrics` (weights and anchors per version).

## Local

```
npm install
npm run dev
```

Test the AI pipeline on one CV without the database: `node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/test-pipeline.ts path/to/cv.pdf PM`
