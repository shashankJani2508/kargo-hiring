import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { GATES, RUBRIC_VERSION, VARIABLES, WEIGHTS } from "./rubric";

let _sql: NeonQueryFunction<false, false> | null = null;
export function sql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set — add your Neon connection string.");
    const raw = neon(url);
    // Neon's HTTP driver can drop a request while a sleeping database wakes up; retry those.
    const wrapped = ((strings: TemplateStringsArray, ...values: unknown[]) =>
      withRetry(() => raw(strings, ...values))) as NeonQueryFunction<false, false>;
    wrapped.query = ((text: string, params?: unknown[]) => withRetry(() => raw.query(text, params))) as unknown as typeof raw.query;
    _sql = wrapped;
  }
  return _sql;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (attempt >= 3 || !/fetch failed|ECONNRESET|ETIMEDOUT|socket|connecting to database/i.test(msg)) throw e;
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    }
  }
}

let ready: Promise<void> | null = null;
export function ensureSchema() {
  if (!ready) ready = migrate().catch((e) => ((ready = null), Promise.reject(e)));
  return ready;
}

async function migrate() {
  const q = sql();
  await q`CREATE TABLE IF NOT EXISTS candidates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    role_applied text NOT NULL,
    file_name text,
    file_mime text,
    status text NOT NULL DEFAULT 'processing',
    error text,
    name text, email text, phone text, location text,
    cv_content text,
    pm_eval jsonb,
    spm_eval jsonb,
    primary_role text,
    primary_note text,
    decision text,
    total numeric,
    path text,
    brief text,
    why_line text,
    invite_draft jsonb,
    decline_draft jsonb,
    rubric_version text,
    scored_at timestamptz,
    stage text NOT NULL DEFAULT 'new',
    arjun_decision text,
    arjun_reason text,
    decided_at timestamptz,
    interview jsonb,
    interview_feedback jsonb,
    email_log jsonb NOT NULL DEFAULT '[]'::jsonb
  )`;
  await q`CREATE TABLE IF NOT EXISTS cv_files (
    candidate_id uuid PRIMARY KEY REFERENCES candidates(id) ON DELETE CASCADE,
    data_b64 text NOT NULL
  )`;
  await q`CREATE TABLE IF NOT EXISTS events (
    id bigserial PRIMARY KEY,
    candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE,
    type text NOT NULL,
    payload jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS settings (
    id int PRIMARY KEY DEFAULT 1,
    data jsonb NOT NULL DEFAULT '{}'::jsonb
  )`;
  await q`CREATE TABLE IF NOT EXISTS rubrics (
    version text PRIMARY KEY,
    config jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS integrations (
    id text PRIMARY KEY,
    data jsonb NOT NULL
  )`;
  await q`CREATE INDEX IF NOT EXISTS candidates_created_idx ON candidates (created_at DESC)`;
  await q`INSERT INTO settings (id, data) VALUES (1, ${JSON.stringify(DEFAULT_SETTINGS)}::jsonb) ON CONFLICT (id) DO NOTHING`;
  await q`INSERT INTO rubrics (version, config) VALUES (${RUBRIC_VERSION}, ${JSON.stringify({
    weights: WEIGHTS,
    variables: VARIABLES,
    gates: GATES,
  })}::jsonb) ON CONFLICT (version) DO NOTHING`;
}

export interface Settings {
  interviewer_name: string;
  interviewer_title: string;
  company: string;
  meet_link: string;
  duration_minutes: number;
  reply_to: string;
  work_start: string;
  work_end: string;
}

export const DEFAULT_SETTINGS: Settings = {
  interviewer_name: "Arjun Mehta",
  interviewer_title: "Founder, Kargo",
  company: "Kargo",
  meet_link: "",
  duration_minutes: 45,
  reply_to: "",
  work_start: "10:00",
  work_end: "18:00",
};

export async function getSettings(): Promise<Settings> {
  await ensureSchema();
  const rows = await sql()`SELECT data FROM settings WHERE id = 1`;
  return { ...DEFAULT_SETTINGS, ...(rows[0]?.data ?? {}) };
}

export async function logEvent(candidateId: string, type: string, payload: unknown) {
  await sql()`INSERT INTO events (candidate_id, type, payload) VALUES (${candidateId}, ${type}, ${JSON.stringify(payload)}::jsonb)`;
}
