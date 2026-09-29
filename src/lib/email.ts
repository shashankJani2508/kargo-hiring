import { Resend } from "resend";
import { renderEmail, slotStart, type InterviewSlot } from "./email-render";

export * from "./email-render";

function ics(slot: InterviewSlot, summary: string, organizer: string) {
  const start = slotStart(slot);
  const end = new Date(start.getTime() + slot.duration_minutes * 60_000);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kargo//Hiring//EN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@kargo`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
    `SUMMARY:${summary}`, `LOCATION:${slot.meet_link}`, `DESCRIPTION:Join Google Meet: ${slot.meet_link}`,
    `ORGANIZER;CN=${organizer}:mailto:noreply@kargo.local`, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

export function emailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  body: string;
  slot: InterviewSlot | null;
  replyTo?: string;
  organizer: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set — add it in Vercel environment variables.");
  const resend = new Resend(key);
  const override = process.env.EMAIL_OVERRIDE_TO?.trim();
  const to = override || args.to;
  const { html, text } = renderEmail(args.body, args.slot);
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "Kargo Hiring <onboarding@resend.dev>",
    to: [to],
    subject: args.subject,
    html,
    text,
    ...(args.replyTo ? { replyTo: args.replyTo } : {}),
    ...(args.slot
      ? { attachments: [{ filename: "interview.ics", content: Buffer.from(ics(args.slot, args.subject, args.organizer)).toString("base64") }] }
      : {}),
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  return { id: data?.id ?? null, to, overridden: !!override };
}
