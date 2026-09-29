import { sql } from "@/lib/db";

export async function GET(_req: Request, ctx: RouteContext<"/api/candidates/[id]/file">) {
  const { id } = await ctx.params;
  const rows = await sql()`SELECT c.file_name, c.file_mime, f.data_b64 FROM candidates c JOIN cv_files f ON f.candidate_id = c.id WHERE c.id = ${id}`;
  if (!rows[0]) return new Response("Not found", { status: 404 });
  const name = (rows[0].file_name as string) || "cv";
  const mime = (rows[0].file_mime as string) || (name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
  return new Response(Buffer.from(rows[0].data_b64 as string, "base64"), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `${mime === "application/pdf" ? "inline" : "attachment"}; filename="${encodeURIComponent(name)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
