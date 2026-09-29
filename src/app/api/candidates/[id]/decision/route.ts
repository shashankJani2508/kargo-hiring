import { NextResponse } from "next/server";
import { getSettings, logEvent, sql } from "@/lib/db";
import { getCandidate } from "@/lib/candidates";
import { sendEmail, slotStart, type InterviewSlot } from "@/lib/email";
import { isShortlisted } from "@/lib/rubric";
import type { EmailLogEntry, InterviewInfo } from "@/lib/types";

interface Body {
  action: "invite" | "decline";
  subject: string;
  body: string;
  reason?: string;
  send?: boolean;
  slot?: InterviewSlot;
}

export async function POST(request: Request, ctx: RouteContext<"/api/candidates/[id]/decision">) {
  const { id } = await ctx.params;
  const c = await getCandidate(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = (await request.json()) as Body;
  if (b.action !== "invite" && b.action !== "decline") return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const send = b.send !== false;
  const settings = await getSettings();
  let slot: InterviewSlot | null = null;
  if (b.action === "invite") {
    if (!b.slot?.date || !b.slot?.time || !b.slot?.meet_link) {
      return NextResponse.json({ error: "Pick a date, time and Google Meet link for the interview." }, { status: 400 });
    }
    if (!/^https?:\/\//.test(b.slot.meet_link)) return NextResponse.json({ error: "Meet link must start with https://" }, { status: 400 });
    slot = { ...b.slot, duration_minutes: Number(b.slot.duration_minutes) || settings.duration_minutes };
  }
  if (send && !c.email) return NextResponse.json({ error: "No email address was found on this CV." }, { status: 400 });
  if (send && (!b.subject?.trim() || !b.body?.trim())) return NextResponse.json({ error: "Subject and message are required." }, { status: 400 });

  const agreed = c.decision ? isShortlisted(c.decision) === (b.action === "invite") : true;
  let entry: EmailLogEntry | null = null;
  if (send) {
    try {
      const r = await sendEmail({
        to: c.email!,
        subject: b.subject.trim(),
        body: b.body,
        slot,
        replyTo: settings.reply_to || undefined,
        organizer: settings.interviewer_name,
      });
      entry = { kind: b.action, to: r.to, subject: b.subject.trim(), sent_at: new Date().toISOString(), resend_id: r.id, overridden: r.overridden, status: "sent" };
    } catch (e) {
      const failed: EmailLogEntry = {
        kind: b.action, to: c.email!, subject: b.subject, sent_at: new Date().toISOString(), resend_id: null, overridden: false, status: "failed", error: (e as Error).message,
      };
      await sql()`UPDATE candidates SET email_log = email_log || ${JSON.stringify([failed])}::jsonb, updated_at = now() WHERE id = ${id}`;
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  }

  const interview: InterviewInfo | null = slot ? { ...slot, scheduled_at: slotStart(slot).toISOString() } : null;
  const stage = b.action === "invite" ? "invited" : "declined";
  const decisionLabel = b.action === "invite" ? "Shortlisted" : "Rejected";
  await sql()`UPDATE candidates SET
    stage = ${stage}, arjun_decision = ${decisionLabel}, arjun_reason = ${b.reason?.trim() || null}, decided_at = now(),
    interview = COALESCE(${interview ? JSON.stringify(interview) : null}::jsonb, interview),
    email_log = email_log || ${JSON.stringify(entry ? [entry] : [])}::jsonb, updated_at = now()
    WHERE id = ${id}`;
  await logEvent(id, "decision", { action: b.action, agreed_with_rubric: agreed, reason: b.reason ?? null, emailed: !!entry });

  return NextResponse.json({ candidate: await getCandidate(id), email: entry });
}
