import { bucketOf, compareEvaluations, dueDate, type Evaluation } from "./rubric";
import type { Candidate } from "./types";

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}

export function primaryEval(c: Candidate): Evaluation | null {
  if (c.status !== "ready") return null;
  return (c.primary_role === "SPM" ? c.spm_eval : c.pm_eval) ?? null;
}

export function bucket(c: Candidate) {
  return c.decision ? bucketOf(c.decision) : null;
}

export function rankCandidates(list: Candidate[]) {
  const ready = list.filter((c) => primaryEval(c));
  ready.sort((a, b) => compareEvaluations(primaryEval(a)!, primaryEval(b)!));
  const rankByRole: Record<string, number> = {};
  const ranks = new Map<string, number>();
  for (const c of ready) {
    const r = c.primary_role ?? "PM";
    rankByRole[r] = (rankByRole[r] ?? 0) + 1;
    ranks.set(c.id, rankByRole[r]);
  }
  return { ordered: ready, ranks };
}

export function due(c: Candidate) {
  if (!c.decision || !c.scored_at || c.stage !== "new") return null;
  const d = dueDate(c.decision, new Date(c.scored_at));
  const ms = d.getTime() - Date.now();
  return { date: d, overdue: ms < 0, hours: ms / 3600_000 };
}
