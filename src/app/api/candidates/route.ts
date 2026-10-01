import { NextResponse } from "next/server";
import { ensureSchema, logEvent, sql } from "@/lib/db";
import { getCandidate, listCandidates, markError, saveResult } from "@/lib/candidates";
import { assertSupported, ingest, scoreAll } from "@/lib/pipeline";
import type { Role } from "@/lib/rubric";

export const maxDuration = 300;

export async function GET() {
  try {
    return NextResponse.json({ candidates: await listCandidates() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  let id: string | null = null;
  try {
    await ensureSchema();
    const form = await request.formData();
    const file = form.get("file");
    const role = form.get("role") === "SPM" ? "SPM" : ("PM" as Role);
    if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "File is larger than 4 MB" }, { status: 413 });

    const buf = Buffer.from(await file.arrayBuffer());
    assertSupported(file.name, file.type); // validate before we store anything

    const rows = await sql()`INSERT INTO candidates (role_applied, file_name, file_mime, status)
      VALUES (${role}, ${file.name}, ${file.type || null}, 'processing') RETURNING id`;
    id = rows[0].id as string;
    await sql()`INSERT INTO cv_files (candidate_id, data_b64) VALUES (${id}, ${buf.toString("base64")})`;
    await logEvent(id, "uploaded", { file: file.name, role });

    const extracted = await ingest(buf, file.type, file.name);
    const scored = await scoreAll(extracted.cv_content, role);
    await saveResult(id, scored, extracted);
    return NextResponse.json({ candidate: await getCandidate(id) });
  } catch (e) {
    const message = (e as Error).message || "Processing failed";
    if (id) await markError(id, message).catch(() => {});
    return NextResponse.json({ error: message, id }, { status: 500 });
  }
}
