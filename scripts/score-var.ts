import { readFileSync } from "node:fs";
import { score } from "../src/lib/pipeline";
const txt = readFileSync(process.argv[2], "utf8").replace(/^.*\n.*\n/, "");
(async () => {
  const t0 = performance.now();
  const e = await score("PM", txt);
  console.log(process.env.SCORE_THINKING, ((performance.now() - t0) / 1000).toFixed(1) + "s", e.decision, e.total, Object.entries(e.scores).slice(0, 8).map(([k, v]) => k + "=" + v.score).join(" "));
})();
