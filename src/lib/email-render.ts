import { ROLE_LABEL, type Role } from "./rubric";

// Pure email rendering, safe to import in the browser (used for the live preview).

export interface InterviewSlot {
  date: string; // YYYY-MM-DD (IST)
  time: string; // HH:mm (IST)
  duration_minutes: number;
  meet_link: string;
}

export function firstName(full: string | null | undefined) {
  const f = (full ?? "").trim().split(/\s+/)[0] ?? "";
  if (!f) return "there";
  return f === f.toUpperCase() ? f.charAt(0) + f.slice(1).toLowerCase() : f;
}

export function slotStart(slot: InterviewSlot) {
  return new Date(`${slot.date}T${slot.time}:00+05:30`);
}

export function formatSlot(slot: InterviewSlot) {
  const start = slotStart(slot);
  const date = start.toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
  });
  const time = start.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
  return { date, time: `${time.toUpperCase()} IST`, duration: `${slot.duration_minutes} minutes` };
}

export function detailsText(slot: InterviewSlot) {
  const f = formatSlot(slot);
  return `Date: ${f.date}\nTime: ${f.time} (${f.duration})\nGoogle Meet: ${slot.meet_link}`;
}

// Fill [FIRST_NAME] and [ROLE_TITLE]; [INTERVIEW_DETAILS] stays until render.
export function personalise(text: string, name: string | null, role: Role) {
  return text.replaceAll("[FIRST_NAME]", firstName(name)).replaceAll("[ROLE_TITLE]", ROLE_LABEL[role]);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderEmail(body: string, slot: InterviewSlot | null) {
  let text = body;
  if (slot) {
    if (!text.includes("[INTERVIEW_DETAILS]")) text = text.replace(/\n\n/, `\n\n[INTERVIEW_DETAILS]\n\n`);
    text = text.replaceAll("[INTERVIEW_DETAILS]", detailsText(slot));
  } else {
    text = text.replaceAll("[INTERVIEW_DETAILS]", "");
  }

  const card = slot
    ? (() => {
        const f = formatSlot(slot);
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;border:1px solid #E6E3DC;border-radius:12px;background:#FAF9F6">
<tr><td style="padding:20px 22px">
<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6B7080;margin-bottom:10px">Interview details</div>
<div style="font-size:15px;color:#0B0D12;line-height:1.7"><strong>${esc(f.date)}</strong><br>${esc(f.time)} · ${esc(f.duration)}</div>
<a href="${esc(slot.meet_link)}" style="display:inline-block;margin-top:14px;background:#1E4D3F;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600">Join Google Meet</a>
<div style="font-size:12px;color:#6B7080;margin-top:10px;word-break:break-all">${esc(slot.meet_link)}</div>
</td></tr></table>`;
      })()
    : "";

  const paras = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) =>
      p === "[INTERVIEW_DETAILS]"
        ? card
        : `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#1F232B">${esc(p.replaceAll("[INTERVIEW_DETAILS]", "")).replace(/\n/g, "<br>")}</p>`,
    );
  if (slot && !body.includes("[INTERVIEW_DETAILS]")) paras.splice(1, 0, card);

  const html = `<!doctype html><html><body style="margin:0;background:#F6F5F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F5F2;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #E6E3DC;border-radius:16px">
<tr><td style="padding:28px 32px 8px"><div style="font-size:18px;font-weight:700;letter-spacing:-.01em;color:#0B0D12">Kargo</div></td></tr>
<tr><td style="padding:16px 32px 20px">${paras.join("\n")}</td></tr>
</table>
<div style="font-size:11px;color:#9A9DA6;margin-top:16px">Kargo · Mumbai</div>
</td></tr></table></body></html>`;
  return { html, text };
}
