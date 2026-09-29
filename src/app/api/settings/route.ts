import { NextResponse } from "next/server";
import { DEFAULT_SETTINGS, getSettings, sql, type Settings } from "@/lib/db";
import { emailConfigured } from "@/lib/email";

export async function GET() {
  try {
    return NextResponse.json({
      settings: await getSettings(),
      email: { configured: emailConfigured(), from: process.env.EMAIL_FROM || null, override: process.env.EMAIL_OVERRIDE_TO || null },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const body = (await request.json()) as Partial<Settings>;
  const current = await getSettings();
  const next: Settings = { ...current };
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (body[k] === undefined) continue;
    (next as unknown as Record<string, unknown>)[k] = k === "duration_minutes" ? Math.max(15, Math.min(180, Number(body[k]) || 45)) : String(body[k]).trim();
  }
  await sql()`UPDATE settings SET data = ${JSON.stringify(next)}::jsonb WHERE id = 1`;
  return NextResponse.json({ settings: next });
}
