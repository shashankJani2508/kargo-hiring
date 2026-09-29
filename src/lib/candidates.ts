import { ensureSchema, logEvent, sql } from "./db";
import type { PipelineResult } from "./pipeline";
import type { Candidate } from "./types";

export function toCandidate(r: Record<string, unknown>): Candidate {
  return {
    id: r.id as string,
    created_at: iso(r.created_at),
    role_applied: r.role_applied as Candidate["role_applied"],
    file_name: (r.file_name as string) ?? null,
    status: r.status as Candidate["status"],
    error: (r.error as string) ?? null,
    name: (r.name as string) ?? null,
    email: (r.email as string) ?? null,
    phone: (r.phone as string) ?? null,
    location: (r.location as string) ?? null,
    pm_eval: (r.pm_eval as Candidate["pm_eval"]) ?? null,
    spm_eval: (r.spm_eval as Candidate["spm_eval"]) ?? null,
    primary_role: (r.primary_role as Candidate["primary_role"]) ?? null,
    primary_note: (r.primary_note as string) ?? null,
    decision: (r.decision as Candidate["decision"]) ?? null,
    total: r.total == null ? null : Number(r.total),
    path: (r.path as Candidate["path"]) ?? null,
    brief: (r.brief as string) ?? null,
    why_line: (r.why_line as string) ?? null,
    invite_draft: (r.invite_draft as Candidate["invite_draft"]) ?? null,
    decline_draft: (r.decline_draft as Candidate["decline_draft"]) ?? null,
    rubric_version: (r.rubric_version as string) ?? null,
    scored_at: r.scored_at ? iso(r.scored_at) : null,
    stage: (r.stage as Candidate["stage"]) ?? "new",
    arjun_decision: (r.arjun_decision as string) ?? null,
    arjun_reason: (r.arjun_reason as string) ?? null,
    decided_at: r.decided_at ? iso(r.decided_at) : null,
    interview: (r.interview as Candidate["interview"]) ?? null,
    interview_feedback: (r.interview_feedback as Candidate["interview_feedback"]) ?? null,
    email_log: (r.email_log as Candidate["email_log"]) ?? [],
  };
}
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

const COLUMNS = `id, created_at, role_applied, file_name, status, error, name, email, phone, location, pm_eval, spm_eval,
  primary_role, primary_note, decision, total, path, brief, why_line, invite_draft, decline_draft, rubric_version, scored_at,
  stage, arjun_decision, arjun_reason, decided_at, interview, interview_feedback, email_log`;

export async function listCandidates() {
  await ensureSchema();
  const rows = await sql().query(`SELECT ${COLUMNS} FROM candidates ORDER BY created_at DESC`);
  return rows.map(toCandidate);
}

export async function getCandidate(id: string) {
  await ensureSchema();
  const rows = await sql().query(`SELECT ${COLUMNS}, cv_content FROM candidates WHERE id = $1`, [id]);
  if (!rows[0]) return null;
  return { ...toCandidate(rows[0]), cv_content: rows[0].cv_content as string | null };
}

export async function saveResult(id: string, r: PipelineResult | Omit<PipelineResult, "extracted">, extracted?: PipelineResult["extracted"]) {
  const primary = r.primary_role === "PM" ? r.pm : r.spm;
  const ex = "extracted" in r ? r.extracted : extracted;
  const q = sql();
  if (ex) {
    await q`UPDATE candidates SET name = ${ex.name || null}, email = ${ex.email || null}, phone = ${ex.phone || null},
      location = ${ex.location || null}, cv_content = ${ex.cv_content} WHERE id = ${id}`;
  }
  await q`UPDATE candidates SET
    status = 'ready', error = NULL,
    pm_eval = ${JSON.stringify(r.pm)}::jsonb, spm_eval = ${JSON.stringify(r.spm)}::jsonb,
    primary_role = ${r.primary_role}, primary_note = ${r.primary_note},
    decision = ${primary.decision}, total = ${primary.total}, path = ${primary.path},
    brief = ${r.drafts.brief}, why_line = ${r.drafts.why_line},
    invite_draft = ${JSON.stringify(r.drafts.invite)}::jsonb, decline_draft = ${JSON.stringify(r.drafts.decline)}::jsonb,
    rubric_version = ${primary.rubric_version}, scored_at = now(), updated_at = now()
    WHERE id = ${id}`;
  await logEvent(id, "scored", { decision: primary.decision, total: primary.total, role: r.primary_role });
}

export async function markError(id: string, message: string) {
  await sql()`UPDATE candidates SET status = 'error', error = ${message.slice(0, 500)}, updated_at = now() WHERE id = ${id}`;
}
