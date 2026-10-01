import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { ingest, score, draft } from "../src/lib/pipeline";
import { pickPrimary } from "../src/lib/rubric";

const file = process.argv[2];
const t = () => performance.now();
(async () => {
  const t0 = t();
  const buf = readFileSync(file);
  const ex = await ingest(buf, "", basename(file));
  const t1 = t();
  const [pm, spm] = await Promise.all([score("PM", ex.cv_content), score("SPM", ex.cv_content)]);
  const t2 = t();
  const p = pickPrimary("PM", pm, spm);
  await draft(p.role === "PM" ? pm : spm, p.note, "PM");
  const t3 = t();
  console.log(JSON.stringify({ extract: ((t1 - t0) / 1000).toFixed(1), score: ((t2 - t1) / 1000).toFixed(1), draft: ((t3 - t2) / 1000).toFixed(1), total: ((t3 - t0) / 1000).toFixed(1), pm: [pm.decision, pm.total], spm: [spm.decision, spm.total] }));
})();
