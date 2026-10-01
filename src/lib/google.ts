// Google Calendar: one-time OAuth connection, free/busy lookups, and events with Meet links.

import { ensureSchema, sql } from "./db";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.freebusy", "openid", "email"];

export function googleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(origin: string) {
  return `${origin}/api/google/callback`;
}

export function authUrl(origin: string, state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

interface Stored {
  refresh_token: string;
  email: string | null;
  connected_at: string;
}

async function readStored(): Promise<Stored | null> {
  await ensureSchema();
  const rows = await sql()`SELECT data FROM integrations WHERE id = 'google'`;
  return (rows[0]?.data as Stored) ?? null;
}

export async function googleStatus() {
  if (!googleConfigured()) return { configured: false, connected: false, email: null as string | null };
  const s = await readStored();
  return { configured: true, connected: !!s?.refresh_token, email: s?.email ?? null };
}

export async function exchangeCode(code: string, origin: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.error || "Google sign-in failed");
  if (!json.refresh_token) throw new Error("Google didn't return a refresh token. Remove Kargo Hiring from your Google account's third-party access and connect again.");
  let email: string | null = null;
  if (json.id_token) {
    try {
      email = JSON.parse(Buffer.from(json.id_token.split(".")[1], "base64url").toString()).email ?? null;
    } catch {}
  }
  const data: Stored = { refresh_token: json.refresh_token, email, connected_at: new Date().toISOString() };
  await sql()`INSERT INTO integrations (id, data) VALUES ('google', ${JSON.stringify(data)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`;
  cached = null;
  return data;
}

export async function disconnect() {
  await sql()`DELETE FROM integrations WHERE id = 'google'`;
  cached = null;
}

let cached: { token: string; exp: number } | null = null;
async function accessToken(): Promise<string | null> {
  if (!googleConfigured()) return null;
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const s = await readStored();
  if (!s?.refresh_token) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: s.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google Calendar connection expired — reconnect it in Settings (${json.error ?? res.status}).`);
  cached = { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cached.token;
}

async function gapi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  if (!token) throw new Error("Google Calendar is not connected.");
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google Calendar: ${json?.error?.message ?? res.status}`);
  return json as T;
}

export async function isConnected() {
  return !!(await accessToken().catch(() => null));
}

export async function busyIntervals(from: Date, to: Date): Promise<{ start: number; end: number }[]> {
  const r = await gapi<{ calendars: Record<string, { busy: { start: string; end: string }[] }> }>("/freeBusy", {
    method: "POST",
    body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), timeZone: "Asia/Kolkata", items: [{ id: "primary" }] }),
  });
  return (r.calendars?.primary?.busy ?? []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
}

export async function createMeetEvent(args: { summary: string; description: string; start: Date; end: Date; attendee?: string | null }) {
  const ev = await gapi<{ id: string; htmlLink: string; hangoutLink?: string; conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] } }>(
    "/calendars/primary/events?conferenceDataVersion=1&sendUpdates=none",
    {
      method: "POST",
      body: JSON.stringify({
        summary: args.summary,
        description: args.description,
        start: { dateTime: args.start.toISOString(), timeZone: "Asia/Kolkata" },
        end: { dateTime: args.end.toISOString(), timeZone: "Asia/Kolkata" },
        attendees: args.attendee ? [{ email: args.attendee }] : [],
        conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } },
        reminders: { useDefault: true },
      }),
    },
  );
  const meet = ev.hangoutLink ?? ev.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri;
  if (!meet) throw new Error("Google created the event but no Meet link came back. Check that Google Meet is enabled for this account.");
  return { eventId: ev.id, eventLink: ev.htmlLink, meetLink: meet };
}

export async function deleteEvent(eventId: string) {
  await gapi(`/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=none`, { method: "DELETE" }).catch(() => {});
}
