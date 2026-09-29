import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { runPipeline } from "../src/lib/pipeline";

const file = process.argv[2];
const role = (process.argv[3] || "PM") as "PM" | "SPM";
const t0 = Date.now();
runPipeline(readFileSync(file), "", basename(file), role).then((r) => {
  const s = (e: typeof r.pm) => `${e.role}: ${e.decision} ${e.total} path ${e.path} gates ${e.gates_passed ? "ok" : e.failed_gates.join(",")} | ` +
    Object.entries(e.scores).map(([k, v]) => `${k}=${v.score}`).join(" ");
  console.log("secs", ((Date.now() - t0) / 1000).toFixed(1));
  console.log("PII", r.extracted.name, r.extracted.email, r.extracted.phone, r.extracted.location);
  console.log("content leak check:", r.extracted.name && r.extracted.cv_content.includes(r.extracted.name.split(" ")[0]));
  console.log(s(r.pm)); console.log(s(r.spm));
  console.log("primary", r.primary_role, r.primary_note);
  console.log("archetype", r.pm.archetype, "| probes", JSON.stringify(r.pm.interview_probes).slice(0, 400));
  console.log("BRIEF", r.drafts.brief); console.log("WHY", r.drafts.why_line);
  console.log("INVITE", r.drafts.invite.subject, "\n", r.drafts.invite.body);
  console.log("DECLINE", r.drafts.decline.subject, "\n", r.drafts.decline.body);
}).catch((e) => { console.error("FAILED", e); process.exit(1); });
