// Picks the next free interview slot for Arjun: weekdays, working hours (IST),
// clear of his Google Calendar and of interviews already booked in the tool.

import { sql, type Settings } from "./db";
import { busyIntervals, isConnected } from "./google";
import type { InterviewSlot } from "./email-render";

const IST = "+05:30";
const STEP_MIN = 30;
const BUFFER_MIN = 15;
const MIN_NOTICE_H = 12; // an evening approval lands on the next morning
const SEARCH_DAYS = 21;
const LUNCH = ["13:00", "14:00"];

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const istDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const istDay = (date: string) => new Date(`${date}T12:00:00${IST}`).getUTCDay();
const at = (date: string, min: number) => new Date(`${date}T${hhmm(min)}:00${IST}`);

async function bookedInTool(excludeId?: string) {
  const rows = await sql()`SELECT id, interview FROM candidates
    WHERE interview IS NOT NULL AND stage IN ('invited', 'interviewed', 'offer')
      AND (interview->>'scheduled_at')::timestamptz > now() - interval '1 day'`;
  return rows
    .filter((r) => r.id !== excludeId)
    .map((r) => {
      const i = r.interview as { scheduled_at: string; duration_minutes: number };
      const start = Date.parse(i.scheduled_at);
      return { start, end: start + (i.duration_minutes || 45) * 60_000 };
    });
}

export async function nextSlot(settings: Settings, opts: { excludeCandidateId?: string } = {}): Promise<InterviewSlot> {
  const duration = settings.duration_minutes || 45;
  const dayStart = toMin(settings.work_start || "10:00");
  const dayEnd = toMin(settings.work_end || "18:00");
  const earliest = Date.now() + MIN_NOTICE_H * 3600_000;
  const horizon = new Date(earliest + SEARCH_DAYS * 86400_000);

  const busy = await bookedInTool(opts.excludeCandidateId);
  if (await isConnected()) busy.push(...(await busyIntervals(new Date(earliest), horizon)));

  const free = (start: number, end: number) =>
    busy.every((b) => end + BUFFER_MIN * 60_000 <= b.start || start >= b.end + BUFFER_MIN * 60_000);

  for (let d = 0; d <= SEARCH_DAYS; d++) {
    const date = istDate(new Date(earliest + d * 86400_000));
    const dow = istDay(date);
    if (dow === 0 || dow === 6) continue;
    for (let m = dayStart; m + duration <= dayEnd; m += STEP_MIN) {
      if (m < toMin(LUNCH[1]) && m + duration > toMin(LUNCH[0])) continue;
      const start = at(date, m).getTime();
      const end = start + duration * 60_000;
      if (start < earliest || !free(start, end)) continue;
      return { date, time: hhmm(m), duration_minutes: duration, meet_link: "" };
    }
  }
  throw new Error("No free interview slot in the next three weeks — check working hours in Settings.");
}
