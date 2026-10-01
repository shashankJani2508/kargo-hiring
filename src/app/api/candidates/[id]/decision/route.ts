import { NextResponse } from "next/server";
import { getSettings, logEvent, sql } from "@/lib/db";
import { getCandidate } from "@/lib/candidates";
import { emailConfigured, personalise, sendEmail, slotStart, type InterviewSlot } from "@/lib/email";
import { createMeetEvent, deleteEvent, isConnected } from "@/lib/google";
import { nextSlot } from "@/lib/schedule";
import { isShortlisted, ROLE_LABEL } from "@/lib/rubric";
import type { EmailLogEntry, InterviewInfo } from "@/lib/types";

export const maxDuration = 60;

// Arjun only says yes or no. Anything he doesn't supply — time, Meet link,
// subject, message — is prepared here from the drafts and his calendar.
interface Body {
  action: "invite" | "decline";
  subject?: string;
  body?: string;
  reason?: string;
  slot?: Partial<InterviewSlot>;
}

export async function POST(request: Request, ctx: RouteContext<"/api/candidates/[id]/decision">) {
  const { id } = await ctx.params;
  const c = await getCandidate(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = (await request.json()) as Body;
  if (b.action !== "invite" && b.action !== "decline") return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const settings = await getSettings();
  const role = c.primary_role ?? c.role_applied;
  const draft = b.action === "invite" ? c.invite_draft : c.decline_draft;
  const subject = (b.subject?.trim() || personalise(draft?.subject ?? "", c.name, role)).trim()
    || (b.action === "invite" ? `Interview invitation — ${ROLE_LABEL[role]} at Kargo` : `Your ${ROLE_LABEL[role]} application at Kargo`);
  const body = b.body?.trim() ? b.body : personalise(draft?.body ?? "", c.name, role);
  const send = emailConfigured() && !!c.email && !!body.trim();

  let interview: InterviewInfo | null = null;
  let slot: InterviewSlot | null = null;
  try {
    if (b.action === "invite") {
      const auto = await nextSlot(settings, { excludeCandidateId: id });
      slot = {
        date: b.slot?.date || auto.date,
        time: b.slot?.time || auto.time,
        duration_minutes: Number(b.slot?.duration_minutes) || auto.duration_minutes,
        meet_link: b.slot?.meet_link?.trim() || "",
      };
      const start = slotStart(slot);
      const end = new Date(start.getTime() + slot.duration_minutes * 60_000);
      let eventId: string | null = null;
      let eventLink: string | null = null;
      if (!slot.meet_link && (await isConnected())) {
        const ev = await createMeetEvent({
          summary: `Kargo interview — ${c.name ?? "Candidate"} (${ROLE_LABEL[role]})`,
          description: [c.brief, c.email ? `Candidate: ${c.email}` : ""].filter(Boolean).join("\n\n"),
          start,
          end,
          attendee: process.env.EMAIL_OVERRIDE_TO?.trim() || c.email,
        });
        slot.meet_link = ev.meetLink;
        eventId = ev.eventId;
        eventLink = ev.eventLink;
      }
      if (!slot.meet_link) slot.meet_link = settings.meet_link;
      if (!slot.meet_link) {
        return NextResponse.json(
          { error: "No Google Meet link available. Connect Google Calendar in Settings (one-time) so links are created automatically." },
          { status: 400 },
        );
      }
      interview = { ...slot, scheduled_at: start.toISOString(), google_event_id: eventId, google_event_link: eventLink };
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  const agreed = c.decision ? isShortlisted(c.decision) === (b.action === "invite") : true;
  let entry: EmailLogEntry | null = null;
  if (send) {
    try {
      const r = await sendEmail({ to: c.email!, subject, body, slot, replyTo: settings.reply_to || undefined, organizer: settings.interviewer_name });
      entry = { kind: b.action, to: r.to, subject, sent_at: new Date().toISOString(), resend_id: r.id, overridden: r.overridden, status: "sent" };
    } catch (e) {
      if (interview?.google_event_id) await deleteEvent(interview.google_event_id);
      const failed: EmailLogEntry = {
        kind: b.action, to: c.email!, subject, sent_at: new Date().toISOString(), resend_id: null, overridden: false, status: "failed", error: (e as Error).message,
      };
      await sql()`UPDATE candidates SET email_log = email_log || ${JSON.stringify([failed])}::jsonb, updated_at = now() WHERE id = ${id}`;
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  }

  // Declining someone who was already invited frees the slot in Arjun's calendar.
  if (b.action === "decline" && c.interview?.google_event_id) await deleteEvent(c.interview.google_event_id);

  const stage = b.action === "invite" ? "invited" : "declined";
  const decisionLabel = b.action === "invite" ? "Shortlisted" : "Rejected";
  await sql()`UPDATE candidates SET
    stage = ${stage}, arjun_decision = ${decisionLabel}, arjun_reason = ${b.reason?.trim() || null}, decided_at = now(),
    interview = ${interview ? JSON.stringify(interview) : c.interview ? JSON.stringify(c.interview) : null}::jsonb,
    email_log = email_log || ${JSON.stringify(entry ? [entry] : [])}::jsonb, updated_at = now()
    WHERE id = ${id}`;
  await logEvent(id, "decision", { action: b.action, agreed_with_rubric: agreed, reason: b.reason ?? null, emailed: !!entry, slot: interview?.scheduled_at ?? null });

  return NextResponse.json({ candidate: await getCandidate(id), email: entry });
}
