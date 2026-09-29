"use client";

import { useState } from "react";
import {
  AlertTriangle, Check, CheckCircle2, FileText, Mail, MapPin, MoreHorizontal, Phone, RefreshCw, Star, Trash2, Video, X, XCircle,
} from "lucide-react";
import { api, due, primaryEval } from "@/lib/client";
import {
  ARCHETYPE_INFO, GATES, NEXT_ACTION, ROLE_LABEL, STANDARD_PROBES, VAR_KEYS, VARIABLES, type Evaluation, type GateKey, type Role,
} from "@/lib/rubric";
import { personalise } from "@/lib/email-render";
import type { Candidate, InterviewFeedback, Outcome, Verdict } from "@/lib/types";
import {
  Avatar, Button, Card, ConfidenceChip, cx, DecisionBadge, Dots, Field, fmtDateTime, inputCls, PATH_INFO, relTime,
  ScoreRing, SectionLabel, Segmented, StageChip, textareaCls, useEscape,
} from "./ui";
import type { DecisionAction } from "./DecisionModal";

export type DrawerTab = "overview" | "scorecard" | "interview" | "emails";

export function CandidateDrawer({ candidate: c, rank, initialTab, onClose, onDecide, onUpdated, onRescore, onRemove, notify }: {
  candidate: Candidate; rank: number | null; initialTab: DrawerTab; onClose: () => void; onDecide: (a: DecisionAction) => void;
  onUpdated: (c: Candidate) => void; onRescore: () => void; onRemove: () => void; notify: (t: string, tone?: "ok" | "err") => void;
}) {
  const [tab, setTab] = useState<DrawerTab>(initialTab);
  const [menu, setMenu] = useState(false);
  useEscape(true, onClose);
  const e = primaryEval(c);
  const role = c.primary_role ?? c.role_applied;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-[#0B0D12]/30 animate-fade-in" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[760px] bg-canvas border-l border-line shadow-pop flex flex-col animate-slide-in">
        {/* Header */}
        <div className="bg-surface border-b border-line px-6 pt-5">
          <div className="flex items-start gap-4">
            <Avatar name={c.name} size={48} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[19px] font-semibold tracking-tight">{c.name ?? "Unnamed candidate"}</h2>
                {rank && <span className="tnum text-[12px] text-faint">#{rank} {role === "SPM" ? "Senior PM" : "PM"}</span>}
                <StageChip stage={c.stage} />
              </div>
              <p className="text-[13.5px] text-muted mt-0.5">{e?.one_line_profile}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-[12.5px] text-ink-2">
                {c.email && <span className="flex items-center gap-1.5"><Mail className="size-3.5 text-faint" />{c.email}</span>}
                {c.phone && <span className="flex items-center gap-1.5"><Phone className="size-3.5 text-faint" />{c.phone}</span>}
                {c.location && <span className="flex items-center gap-1.5"><MapPin className="size-3.5 text-faint" />{c.location}</span>}
                <a href={`/api/candidates/${c.id}/file`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-accent hover:underline">
                  <FileText className="size-3.5" />Original CV
                </a>
              </div>
            </div>
            <div className="relative flex items-center gap-1">
              <button onClick={() => setMenu((m) => !m)} className="size-8 rounded-lg grid place-items-center text-muted hover:bg-[#EFEDE8]" aria-label="More"><MoreHorizontal className="size-4" /></button>
              <button onClick={onClose} className="size-8 rounded-lg grid place-items-center text-muted hover:bg-[#EFEDE8]" aria-label="Close"><X className="size-4" /></button>
              {menu && (
                <div className="absolute right-0 top-10 z-10 w-48 rounded-xl border border-line bg-surface shadow-pop p-1 animate-pop-in" onMouseLeave={() => setMenu(false)}>
                  <button onClick={() => { setMenu(false); onRescore(); }} className="w-full flex items-center gap-2 px-3 h-9 rounded-lg text-[13px] hover:bg-surface-2"><RefreshCw className="size-3.5" /> Re-score with rubric</button>
                  <button onClick={() => { setMenu(false); onRemove(); }} className="w-full flex items-center gap-2 px-3 h-9 rounded-lg text-[13px] text-danger hover:bg-danger-soft"><Trash2 className="size-3.5" /> Remove candidate</button>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-5 mt-5 -mb-px">
            {(["overview", "scorecard", "interview", "emails"] as DrawerTab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={cx("h-10 text-[13px] font-medium border-b-2 transition capitalize", tab === t ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}>
                {t === "interview" ? "Interview brief" : t}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scroll-thin">
          {!e ? (
            <div className="p-8 text-sm text-muted">{c.status === "error" ? c.error : "Scoring in progress…"}</div>
          ) : tab === "overview" ? (
            <Overview c={c} e={e} />
          ) : tab === "scorecard" ? (
            <Scorecard c={c} />
          ) : tab === "interview" ? (
            <InterviewTab c={c} e={e} onUpdated={onUpdated} notify={notify} />
          ) : (
            <Emails c={c} role={role} />
          )}
        </div>

        {/* Footer */}
        {e && (
          <div className="bg-surface border-t border-line px-6 py-3.5 flex items-center gap-3">
            <div className="text-[12px] text-muted min-w-0 truncate">
              {c.stage === "new" ? (c.decision && NEXT_ACTION[c.decision].action) : c.arjun_decision ? `You: ${c.arjun_decision}${c.decided_at ? ` · ${relTime(c.decided_at)}` : ""}` : ""}
            </div>
            <div className="ml-auto flex gap-2">
              {c.stage !== "declined" && <Button variant="danger" onClick={() => onDecide("decline")}><XCircle className="size-4" /> Decline</Button>}
              {(c.stage === "new" || c.stage === "declined") && <Button variant="primary" onClick={() => onDecide("invite")}><CheckCircle2 className="size-4" /> Invite to interview</Button>}
              {(c.stage === "invited" || c.stage === "interviewed") && tab !== "interview" && (
                <Button variant="primary" onClick={() => setTab("interview")}><Star className="size-4" /> {c.interview_feedback ? "View interview brief" : "Log interview brief"}</Button>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

// ---------- Overview ----------

function Overview({ c, e }: { c: Candidate; e: Evaluation }) {
  const d = due(c);
  const arch = ARCHETYPE_INFO[e.archetype];
  return (
    <div className="p-6 space-y-5">
      <Card className="p-5">
        <div className="flex items-center gap-5">
          <ScoreRing value={e.total} decision={e.decision} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <DecisionBadge decision={e.decision} size="md" />
              <span className="text-[12.5px] text-muted">{PATH_INFO[e.path].label} · {PATH_INFO[e.path].hint}</span>
            </div>
            <p className="mt-2.5 text-[14px] leading-relaxed text-ink-2">{c.why_line || e.why_ranked_here}</p>
            {c.primary_note && <p className="mt-1.5 text-[12.5px] text-info">{c.primary_note}</p>}
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
              <span>Scored as {ROLE_LABEL[e.role]}</span>
              <span>Confidence: {e.overall_confidence}</span>
              {d && <span className={d.overdue ? "text-danger" : ""}>{NEXT_ACTION[e.decision].action} · {d.overdue ? "past time limit" : `due ${relTime(d.date.toISOString())}`}</span>}
            </div>
          </div>
        </div>
      </Card>

      {c.interview_feedback && <FeedbackSummary c={c} fb={c.interview_feedback} />}

      <section>
        <SectionLabel>Interview brief</SectionLabel>
        <Card className="p-5">
          <p className="text-[14.5px] leading-[1.7] text-ink-2">{c.brief}</p>
        </Card>
      </section>

      <div className="grid sm:grid-cols-2 gap-4">
        <section>
          <SectionLabel>Strengths</SectionLabel>
          <Card className="p-4 space-y-2.5">
            {e.strengths.map((s, i) => <div key={i} className="flex gap-2.5 text-[13px] leading-snug text-ink-2"><Check className="size-4 text-accent shrink-0 mt-px" />{s}</div>)}
          </Card>
        </section>
        <section>
          <SectionLabel>Gaps</SectionLabel>
          <Card className="p-4 space-y-2.5">
            {e.gaps.map((s, i) => <div key={i} className="flex gap-2.5 text-[13px] leading-snug text-ink-2"><X className="size-4 text-danger shrink-0 mt-px" />{s}</div>)}
          </Card>
        </section>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <section>
          <SectionLabel>Closest past-hire archetype</SectionLabel>
          <Card className="p-4">
            <div className="text-[14px] font-medium">{e.archetype}</div>
            <div className="text-[12.5px] text-muted mt-1">Like {arch.hires} · expected rating <span className="font-medium text-ink-2">{arch.expected}</span></div>
          </Card>
        </section>
        <section>
          <SectionLabel>Flags to probe</SectionLabel>
          <Card className="p-4 space-y-2">
            <div className="flex gap-2 text-[13px]">
              {e.tenure_flag ? <AlertTriangle className="size-4 text-warn shrink-0 mt-px" /> : <CheckCircle2 className="size-4 text-accent shrink-0 mt-px" />}
              <span className="text-ink-2">{e.tenure_note || (e.tenure_flag ? "Tenure flag" : "No tenure flag")}</span>
            </div>
            {e.red_flags.length === 0 && <div className="text-[12.5px] text-faint">No red flags from the rubric list.</div>}
            {e.red_flags.map((f, i) => <div key={i} className="flex gap-2 text-[13px] text-ink-2"><AlertTriangle className="size-4 text-warn shrink-0 mt-px" />{f}</div>)}
          </Card>
        </section>
      </div>

      <section>
        <SectionLabel>What to probe</SectionLabel>
        <Card className="divide-y divide-line">
          {e.interview_probes.map((p, i) => (
            <div key={i} className="px-4 py-3.5 flex gap-3">
              <span className="text-[11px] font-semibold text-accent bg-accent-soft rounded h-5 px-1.5 grid place-items-center shrink-0">{p.variable}</span>
              <div>
                <div className="text-[13.5px] text-ink leading-snug">{p.question}</div>
                {p.why && <div className="text-[12px] text-muted mt-1">{p.why}</div>}
              </div>
            </div>
          ))}
        </Card>
      </section>

      {c.arjun_decision && (
        <section>
          <SectionLabel>Decision record</SectionLabel>
          <Card className="p-4 text-[13px] space-y-1">
            <div><span className="text-muted">System:</span> {c.decision} · {c.total}/100 · rubric {c.rubric_version}</div>
            <div><span className="text-muted">Arjun:</span> {c.arjun_decision}{c.arjun_reason ? ` — “${c.arjun_reason}”` : ""}</div>
            {c.decided_at && <div className="text-faint text-[12px]">{fmtDateTime(c.decided_at)} IST</div>}
          </Card>
        </section>
      )}
    </div>
  );
}

// ---------- Scorecard ----------

function Scorecard({ c }: { c: Candidate }) {
  const [role, setRole] = useState<Role>(c.primary_role ?? "PM");
  const e = role === "SPM" ? c.spm_eval : c.pm_eval;
  if (!e) return null;
  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Role> value={role} onChange={setRole} options={[
          { value: "PM", label: <>Product Manager <span className="tnum text-faint">{c.pm_eval?.total}</span></> },
          { value: "SPM", label: <>Senior PM <span className="tnum text-faint">{c.spm_eval?.total}</span></> },
        ]} />
        <div className="flex items-center gap-2"><DecisionBadge decision={e.decision} /><span className="tnum text-[14px] font-semibold">{e.total}<span className="text-faint font-normal">/100</span></span></div>
      </div>
      {role !== c.primary_role && <p className="text-[12.5px] text-muted -mt-2">Secondary evaluation — the recommendation uses the {ROLE_LABEL[c.primary_role ?? "PM"]} result.</p>}

      <section>
        <SectionLabel>Knockout gates</SectionLabel>
        <Card className="divide-y divide-line">
          {(["G1", "G2", "G3", "G4"] as GateKey[]).map((g) => {
            const gate = e.gates[g];
            const desc = role === "PM" ? GATES[g].PM : GATES[g].SPM;
            return (
              <div key={g} className="px-4 py-3 flex gap-3">
                {!gate.required ? <span className="size-5 rounded-full bg-surface-2 border border-line shrink-0" />
                  : gate.pass ? <CheckCircle2 className="size-5 text-accent shrink-0" /> : <XCircle className="size-5 text-danger shrink-0" />}
                <div className="min-w-0">
                  <div className="text-[13px] font-medium">{g} {GATES[g].name} {!gate.required && <span className="text-faint font-normal">· not required</span>}</div>
                  {desc && <div className="text-[11.5px] text-faint">{desc}</div>}
                  {gate.required && <div className="text-[12.5px] text-ink-2 mt-1">{gate.reason}</div>}
                </div>
              </div>
            );
          })}
        </Card>
      </section>

      <section>
        <SectionLabel right={<span className="text-[11px] text-faint">points = weight × score ÷ 4</span>}>Variables</SectionLabel>
        <Card className="divide-y divide-line">
          {VAR_KEYS.filter((k) => e.scores[k].weight > 0).map((k) => {
            const s = e.scores[k];
            return (
              <div key={k} className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-semibold text-ink-2 w-6">{k}</span>
                  <span className="text-[13.5px] font-medium flex-1 min-w-0 truncate">{VARIABLES[k].name}</span>
                  <Dots score={s.score} />
                  <span className="tnum text-[12.5px] w-24 text-right"><span className="font-semibold">{s.points}</span><span className="text-faint"> / {s.weight}</span></span>
                </div>
                <div className="pl-9 mt-1.5">
                  <div className="text-[12px] text-muted"><span className="font-medium text-ink-2">{s.score} ·</span> {VARIABLES[k].anchors[s.score]}</div>
                  {s.evidence && <div className="text-[12.5px] text-ink-2 mt-1.5 border-l-2 border-line-strong pl-2.5 leading-snug">{s.evidence}</div>}
                  <div className="mt-1"><ConfidenceChip c={s.confidence} /></div>
                </div>
              </div>
            );
          })}
          <div className="px-4 py-3 flex items-center justify-between bg-surface-2 rounded-b-xl">
            <span className="text-[13px] font-medium">Weighted total</span>
            <span className="tnum text-[15px] font-semibold">{e.total} / 100</span>
          </div>
        </Card>
        <p className="text-[11.5px] text-faint mt-2">Zero weight by design: college, MBA, general certifications, employer brand, tools list, PM years beyond the gate, and any personal attribute.</p>
      </section>
    </div>
  );
}

// ---------- Interview brief (Arjun's input) ----------

function InterviewTab({ c, e, onUpdated, notify }: { c: Candidate; e: Evaluation; onUpdated: (c: Candidate) => void; notify: (t: string, tone?: "ok" | "err") => void }) {
  const existing = c.interview_feedback;
  const baseProbes = existing?.probes ?? e.interview_probes.map((p) => ({ variable: p.variable, question: p.question, verdict: "skipped" as Verdict, note: "" }));
  const [probes, setProbes] = useState(baseProbes);
  const [on, setOn] = useState(existing?.interviewed_on ?? (c.interview?.date || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })));
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [outcome, setOutcome] = useState<Outcome>(existing?.outcome ?? "Advance");
  const [summary, setSummary] = useState(existing?.summary ?? "");
  const [busy, setBusy] = useState(false);

  const setProbe = (i: number, patch: Partial<(typeof probes)[number]>) => setProbes((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const addProbe = (variable: string) =>
    setProbes((ps) => [...ps, { variable, question: STANDARD_PROBES[variable as keyof typeof STANDARD_PROBES] ?? "", verdict: "skipped", note: "" }]);

  // Live preview of the rubric adjustment: a weak answer lowers that variable by 1.
  const lowered = new Set(probes.filter((p) => p.verdict === "weak" && (VAR_KEYS as string[]).includes(p.variable)).map((p) => p.variable));
  const previewTotal = Math.round(
    VAR_KEYS.reduce((sum, k) => {
      const s = e.scores[k];
      const score = lowered.has(k) ? Math.max(0, s.score - 1) : s.score;
      return sum + (s.weight * score) / 4;
    }, 0) * 100,
  ) / 100;

  async function save() {
    if (!rating) { notify("Give an overall rating first", "err"); return; }
    setBusy(true);
    try {
      const r = await api<{ candidate: Candidate }>(`/api/candidates/${c.id}/interview`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewed_on: on, probes, rating, outcome, summary }),
      });
      onUpdated(r.candidate);
      notify("Interview brief saved");
    } catch (err) {
      notify((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 space-y-5">
      {c.interview ? (
        <Card className="p-4 flex flex-wrap items-center gap-4">
          <div className="size-10 rounded-xl bg-accent-soft text-accent grid place-items-center"><Video className="size-5" /></div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium">{fmtDateTime(c.interview.scheduled_at)} IST · {c.interview.duration_minutes} min</div>
            <a href={c.interview.meet_link} target="_blank" rel="noreferrer" className="text-[12.5px] text-accent hover:underline break-all">{c.interview.meet_link}</a>
          </div>
        </Card>
      ) : (
        <div className="text-[12.5px] text-muted bg-surface-2 border border-line rounded-xl px-4 py-3">No interview scheduled yet — you can still log notes from a call.</div>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Interviewed on"><input type="date" className={inputCls} value={on} onChange={(ev) => setOn(ev.target.value)} /></Field>
        <Field label="Overall rating">
          <div className="h-10 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`}>
                <Star className={cx("size-6 transition", n <= rating ? "fill-gold text-gold" : "text-line-strong hover:text-gold/60")} />
              </button>
            ))}
          </div>
        </Field>
        <Field label="Outcome">
          <select className={inputCls} value={outcome} onChange={(ev) => setOutcome(ev.target.value as Outcome)}>
            <option value="Advance">Advance to next round</option>
            <option value="Offer">Make an offer</option>
            <option value="Hold">Hold</option>
            <option value="Decline">Decline</option>
          </select>
        </Field>
      </div>

      <section>
        <SectionLabel right={
          <span className="tnum text-[12px] text-muted">CV score {e.total} → <span className={cx("font-semibold", previewTotal < e.total ? "text-warn" : "text-accent")}>{previewTotal}</span></span>
        }>Probes — did the answer confirm the score?</SectionLabel>
        <div className="space-y-2.5">
          {probes.map((p, i) => (
            <Card key={i} className="p-4">
              <div className="flex gap-3">
                <span className="text-[11px] font-semibold text-accent bg-accent-soft rounded h-5 px-1.5 grid place-items-center shrink-0">{p.variable}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] leading-snug">{p.question}</div>
                  {(VAR_KEYS as string[]).includes(p.variable) && (
                    <div className="text-[11.5px] text-faint mt-1">CV score {e.scores[p.variable as keyof typeof e.scores].score}/4 · weak answer lowers it by one</div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Segmented<Verdict> size="sm" value={p.verdict} onChange={(v) => setProbe(i, { verdict: v })} options={[
                      { value: "strong", label: "Strong" }, { value: "weak", label: "Weak" }, { value: "skipped", label: "Not asked" },
                    ]} />
                  </div>
                  <textarea className={cx(textareaCls, "mt-2.5 min-h-[64px] text-[13px]")} placeholder="What they said…" value={p.note} onChange={(ev) => setProbe(i, { note: ev.target.value })} />
                </div>
              </div>
            </Card>
          ))}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-muted mr-1">Add a rubric probe:</span>
          {(["V1", "V2", "V3", "V4", "V5", "V6", "V8", "V9", "G4", "TENURE"] as const).map((k) => (
            <button key={k} onClick={() => addProbe(k)} className="h-7 px-2 rounded-md border border-line bg-surface text-[11.5px] text-ink-2 hover:border-line-strong">+ {k}</button>
          ))}
        </div>
      </section>

      <Field label="Interview brief" hint="Your summary: what you learned, concerns, and the next step. Stored in the decision record.">
        <textarea className={cx(textareaCls, "min-h-[140px]")} value={summary} onChange={(ev) => setSummary(ev.target.value)}
          placeholder="e.g. Walked through a DO release end to end without prompting — knows detention and amendment failure points first-hand. Weaker on roadmap trade-offs; second round with the eng lead." />
      </Field>

      <div className="flex items-center justify-between gap-3">
        {existing && <span className="text-[12px] text-faint">Last saved {relTime(existing.saved_at)}</span>}
        <Button variant="primary" className="ml-auto" loading={busy} onClick={save}>{existing ? "Update interview brief" : "Save interview brief"}</Button>
      </div>
    </div>
  );
}

function FeedbackSummary({ c, fb }: { c: Candidate; fb: InterviewFeedback }) {
  return (
    <section>
      <SectionLabel>Your interview brief · {fb.interviewed_on}</SectionLabel>
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[14px] font-medium">{fb.outcome}</span>
          <span className="text-gold">{"★".repeat(fb.rating)}<span className="text-line-strong">{"★".repeat(5 - fb.rating)}</span></span>
          <span className="tnum text-[12.5px] text-muted ml-auto">CV {c.total} → post-interview <span className="font-semibold text-ink">{fb.adjusted_total}</span> · <DecisionBadge decision={fb.adjusted_decision} /></span>
        </div>
        {fb.summary && <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2 whitespace-pre-wrap">{fb.summary}</p>}
        {fb.lowered.length > 0 && <p className="mt-2 text-[12px] text-warn">Lowered after weak answers: {fb.lowered.join(", ")}</p>}
      </Card>
    </section>
  );
}

// ---------- Emails ----------

function Emails({ c, role }: { c: Candidate; role: Role }) {
  return (
    <div className="p-6 space-y-5">
      {c.email_log.length > 0 && (
        <section>
          <SectionLabel>Sent</SectionLabel>
          <Card className="divide-y divide-line">
            {c.email_log.slice().reverse().map((l, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                {l.status === "sent" ? <CheckCircle2 className="size-4 text-accent" /> : <XCircle className="size-4 text-danger" />}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{l.subject}</div>
                  <div className="text-[12px] text-muted truncate">{l.kind === "invite" ? "Invitation" : "Decline"} · to {l.to}{l.overridden ? " (test inbox)" : ""}{l.error ? ` · ${l.error}` : ""}</div>
                </div>
                <span className="text-[12px] text-faint">{fmtDateTime(l.sent_at)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}
      {[{ label: "Draft invitation", d: c.invite_draft }, { label: "Draft decline", d: c.decline_draft }].map(({ label, d }) =>
        d ? (
          <section key={label}>
            <SectionLabel right={<span className="text-[11px] text-faint">Pending your approval</span>}>{label}</SectionLabel>
            <Card className="p-5">
              <div className="text-[13.5px] font-medium">{personalise(d.subject, c.name, role)}</div>
              <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2 whitespace-pre-wrap">{personalise(d.body, c.name, role)}</p>
            </Card>
          </section>
        ) : null,
      )}
    </div>
  );
}
