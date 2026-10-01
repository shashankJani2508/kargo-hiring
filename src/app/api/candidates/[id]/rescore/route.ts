import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCandidate, markError, saveResult } from "@/lib/candidates";
import { ingest, scoreAll } from "@/lib/pipeline";

export const maxDuration = 300;

export async function POST(_req: Request, ctx: RouteContext<"/api/candidates/[id]">) {
  const { id } = await ctx.params;
  const c = await getCandidate(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    await sql()`UPDATE candidates SET status = 'processing', error = NULL WHERE id = ${id}`;
    let extracted;
    let content = c.cv_content;
    if (!content) {
      const f = await sql()`SELECT data_b64 FROM cv_files WHERE candidate_id = ${id}`;
      if (!f[0]) throw new Error("Original file is missing; please re-upload.");
      extracted = await ingest(Buffer.from(f[0].data_b64 as string, "base64"), "", c.file_name ?? "cv.pdf");
      content = extracted.cv_content;
    }
    const scored = await scoreAll(content, c.role_applied);
    await saveResult(id, scored, extracted);
    return NextResponse.json({ candidate: await getCandidate(id) });
  } catch (e) {
    await markError(id, (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
