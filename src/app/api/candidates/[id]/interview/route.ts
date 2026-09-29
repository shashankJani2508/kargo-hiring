import { NextResponse } from "next/server";
import { logEvent, sql } from "@/lib/db";
import { getCandidate } from "@/lib/candidates";
import { adjustedScores, evaluate, type LlmEvaluation } from "@/lib/rubric";
import type { InterviewFeedback, Outcome, Verdict } from "@/lib/types";

const OUTCOMES: Outcome[] = ["Advance", "Offer", "Hold", "Decline"];

export async function POST(request: Request, ctx: RouteContext<"/api/candidates/[id]/interview">) {
  const { id } = await ctx.params;
  const c = await getCandidate(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const primary = c.primary_role === "SPM" ? c.spm_eval : c.pm_eval;
  if (!primary) return NextResponse.json({ error: "Candidate has not been scored yet." }, { status: 400 });

  const b = await request.json();
  const probes = (Array.isArray(b.probes) ? b.probes : []).map((p: Record<string, unknown>) => ({
    variable: String(p.variable ?? ""),
    question: String(p.question ?? ""),
    verdict: (["strong", "weak", "skipped"].includes(p.verdict as string) ? p.verdict : "skipped") as Verdict,
    note: String(p.note ?? "").slice(0, 2000),
  }));
  const outcome: Outcome = OUTCOMES.includes(b.outcome) ? b.outcome : "Hold";

  // Rubric: a strong answer confirms the score; a weak one lowers it by one point.
  const overrides = adjustedScores(primary, probes);
  const adjusted = evaluate(primary.role, primary as unknown as LlmEvaluation, overrides);

  const feedback: InterviewFeedback = {
    interviewed_on: String(b.interviewed_on || new Date().toISOString().slice(0, 10)),
    probes,
    rating: Math.max(1, Math.min(5, Number(b.rating) || 3)),
    outcome,
    summary: String(b.summary ?? "").slice(0, 8000),
    adjusted_total: adjusted.total,
    adjusted_decision: adjusted.decision,
    lowered: Object.keys(overrides),
    saved_at: new Date().toISOString(),
  };
  const stage = outcome === "Offer" ? "offer" : c.stage === "declined" ? "declined" : "interviewed";
  await sql()`UPDATE candidates SET interview_feedback = ${JSON.stringify(feedback)}::jsonb, stage = ${stage}, updated_at = now() WHERE id = ${id}`;
  await logEvent(id, "interview_feedback", { outcome, rating: feedback.rating, adjusted_total: adjusted.total, lowered: feedback.lowered });
  return NextResponse.json({ candidate: await getCandidate(id) });
}
