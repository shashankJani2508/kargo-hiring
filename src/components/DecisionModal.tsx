"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Eye, PencilLine, XCircle } from "lucide-react";
import { api, primaryEval } from "@/lib/client";
import { GATES, isShortlisted, NEXT_ACTION, ROLE_LABEL, VARIABLES } from "@/lib/rubric";
import { personalise, renderEmail } from "@/lib/email-render";
import type { Candidate } from "@/lib/types";
import type { Settings } from "@/lib/db";
import type { EmailInfo } from "./SettingsModal";
import { Button, cx, DecisionBadge, Field, inputCls, Modal, ModalHeader, textareaCls } from "./ui";

export type DecisionAction = "invite" | "decline";

function nextWorkingDay(days = 2) {
  const d = new Date();
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function DecisionModal({ candidate: c, action, settings, emailInfo, onClose, onDone }: {
  candidate: Candidate; action: DecisionAction; settings: Settings | null; emailInfo: EmailInfo | null;
  onClose: () => void; onDone: (c: Candidate, emailed: boolean) => void;
}) {
  const e = primaryEval(c);
  const role = c.primary_role ?? c.role_applied;
  const invite = action === "invite";
  const shortlisted = c.decision ? isShortlisted(c.decision) : false;
  const override = invite ? !shortlisted : shortlisted;

  const draft = invite ? c.invite_draft : c.decline_draft;
  const [subject, setSubject] = useState(personalise(draft?.subject ?? (invite ? "Interview invitation — [ROLE_TITLE] at Kargo" : "Your [ROLE_TITLE] application at Kargo"), c.name, role));
  const [body, setBody] = useState(personalise(draft?.body ?? "", c.name, role));
  const [date, setDate] = useState(nextWorkingDay(c.decision === "Strong shortlist" ? 1 : 2));
  const [time, setTime] = useState("11:00");
  const [duration, setDuration] = useState(settings?.duration_minutes ?? 45);
  const [meet, setMeet] = useState(settings?.meet_link ?? "");
  const [reason, setReason] = useState("");
  const [send, setSend] = useState(!!emailInfo?.configured && !!c.email);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const html = useMemo(
    () => (preview ? renderEmail(body, invite ? { date, time, duration_minutes: duration, meet_link: meet || "https://meet.google.com/…" } : null).html : ""),
    [preview, body, invite, date, time, duration, meet],
  );

  const failedGates = e?.failed_gates ?? [];
  const topStrengths = (e?.strengths ?? []).slice(0, 3);
  const topGaps = (e?.gaps ?? []).slice(0, 3);

  async function confirm() {
    setError("");
    if (override && !reason.trim()) {
      setError("Add a one-line reason — overrides are logged so the rubric can be recalibrated.");
      return;
    }
    if (invite && (!date || !time || !meet)) {
      setError("Set the interview date, time and Google Meet link.");
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ candidate: Candidate; email: unknown }>(`/api/candidates/${c.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, subject, body, reason, send, slot: invite ? { date, time, duration_minutes: duration, meet_link: meet } : undefined }),
      });
      onDone(r.candidate, !!r.email);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} width="max-w-[760px]">
      <ModalHeader
        onClose={onClose}
        icon={<div className={cx("size-9 rounded-xl grid place-items-center shrink-0", invite ? "bg-accent-soft text-accent" : "bg-danger-soft text-danger")}>{invite ? <CheckCircle2 className="size-[18px]" /> : <XCircle className="size-[18px]" />}</div>}
        title={invite ? `Invite ${c.name ?? "this candidate"} to interview?` : `Decline ${c.name ?? "this candidate"}?`}
        subtitle={`${ROLE_LABEL[role]} · ${c.email ?? "no email found on CV"}`}
      />

      <div className="p-6 space-y-5">
        {/* What the rubric says */}
        <div className={cx("rounded-xl border p-4", override ? "border-warn/30 bg-warn-soft/60" : invite ? "border-accent/20 bg-accent-soft/60" : "border-line bg-surface-2")}>
          <div className="flex flex-wrap items-center gap-2">
            {override ? <AlertTriangle className="size-4 text-warn" /> : <CheckCircle2 className={cx("size-4", invite ? "text-accent" : "text-muted")} />}
            <span className="text-[13px] font-semibold">
              {override
                ? invite ? "The rubric did not shortlist this candidate" : "The rubric recommends shortlisting this candidate"
                : invite ? "The rubric shortlisted this candidate" : "The rubric did not shortlist this candidate"}
            </span>
            <span className="ml-auto flex items-center gap-2">
              <DecisionBadge decision={c.decision} />
              <span className="tnum text-[13px] font-semibold">{c.total}<span className="text-faint font-normal">/100</span></span>
              <span className="text-[12px] text-muted">Path {c.path}</span>
            </span>
          </div>
          {c.why_line && <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-2">{c.why_line}</p>}
          {c.primary_note && <p className="mt-1.5 text-[12.5px] text-muted">{c.primary_note}</p>}

          <div className="mt-3.5 grid sm:grid-cols-2 gap-4">
            {failedGates.length > 0 && (
              <div className="sm:col-span-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-danger mb-1.5">Failed gates</div>
                <ul className="space-y-1">
                  {failedGates.map((g) => <li key={g} className="text-[12.5px] text-ink-2"><span className="font-medium">{g} {GATES[g].name}:</span> {e?.gates[g].reason}</li>)}
                </ul>
              </div>
            )}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent mb-1.5">Why shortlisted / strengths</div>
              <ul className="space-y-1">{topStrengths.map((s, i) => <li key={i} className="text-[12.5px] text-ink-2 leading-snug">• {s}</li>)}</ul>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-danger mb-1.5">Why not / gaps</div>
              <ul className="space-y-1">{topGaps.map((s, i) => <li key={i} className="text-[12.5px] text-ink-2 leading-snug">• {s}</li>)}</ul>
            </div>
          </div>
          {e && (
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {(["V1", "V2", "V3", "V4"] as const).map((k) => (
                <span key={k} className="text-[11.5px] rounded-md bg-surface border border-line px-2 py-1 text-ink-2">
                  {k} {VARIABLES[k].short} <span className="tnum font-semibold">{e.scores[k].score}/4</span>
                </span>
              ))}
              {role === "SPM" && (["V8", "V9"] as const).map((k) => (
                <span key={k} className="text-[11.5px] rounded-md bg-surface border border-line px-2 py-1 text-ink-2">
                  {k} {VARIABLES[k].short} <span className="tnum font-semibold">{e.scores[k].score}/4</span>
                </span>
              ))}
            </div>
          )}
          {c.decision && <p className="mt-3 text-[12px] text-muted">Rubric next action: {NEXT_ACTION[c.decision].action}</p>}
        </div>

        {override && (
          <Field label="Your reason for overriding the rubric" hint="Logged with the decision record. Repeated overrides for the same reason mean a variable is missing.">
            <input className={inputCls} value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder={invite ? "e.g. Strong customs background the CV undersells" : "e.g. Not open to relocating to Mumbai"} />
          </Field>
        )}

        {invite && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(ev) => setDate(ev.target.value)} /></Field>
            <Field label="Time (IST)"><input type="time" className={inputCls} value={time} onChange={(ev) => setTime(ev.target.value)} /></Field>
            <Field label="Duration">
              <select className={inputCls} value={duration} onChange={(ev) => setDuration(Number(ev.target.value))}>
                {[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </Field>
            <Field label="Google Meet link" className="col-span-2 sm:col-span-4"
              hint={<span>Paste your Meet room, or <a href="https://meet.google.com/new" target="_blank" rel="noreferrer" className="text-accent inline-flex items-center gap-0.5 hover:underline">create a new meeting <ExternalLink className="size-3" /></a> and paste its link.</span>}>
              <input className={inputCls} value={meet} onChange={(ev) => setMeet(ev.target.value)} placeholder="https://meet.google.com/abc-defg-hij" />
            </Field>
          </div>
        )}

        {/* Email */}
        <div className="rounded-xl border border-line">
          <div className="flex items-center gap-3 px-4 h-11 border-b border-line bg-surface-2 rounded-t-xl">
            <span className="text-[12px] font-medium text-ink-2">Email to candidate</span>
            <span className="text-[11.5px] text-faint truncate">
              to {emailInfo?.override ? <><s>{c.email}</s> → {emailInfo.override} (test inbox)</> : c.email ?? "—"}
            </span>
            <button onClick={() => setPreview((p) => !p)} className="ml-auto text-[12px] text-muted hover:text-ink flex items-center gap-1.5">
              {preview ? <><PencilLine className="size-3.5" /> Edit</> : <><Eye className="size-3.5" /> Preview</>}
            </button>
          </div>
          {preview ? (
            <iframe title="Email preview" srcDoc={html} className="w-full h-[440px] rounded-b-xl bg-canvas" />
          ) : (
            <div className="p-4 space-y-3">
              <input className={inputCls} value={subject} onChange={(ev) => setSubject(ev.target.value)} />
              <textarea className={cx(textareaCls, "min-h-[220px] font-[inherit]")} value={body} onChange={(ev) => setBody(ev.target.value)} />
              {invite && <p className="text-[11.5px] text-faint">[INTERVIEW_DETAILS] becomes the date, time and a “Join Google Meet” button. A calendar invite (.ics) is attached.</p>}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2.5 text-[13px] cursor-pointer select-none">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={send} disabled={!emailInfo?.configured || !c.email} onChange={(ev) => setSend(ev.target.checked)} />
          <span>Send this email now via Resend</span>
          {!emailInfo?.configured && <span className="text-[12px] text-warn">— RESEND_API_KEY not set; decision will be recorded only</span>}
          {emailInfo?.configured && !c.email && <span className="text-[12px] text-warn">— no email on this CV</span>}
        </label>

        {error && <div className="text-[13px] text-danger bg-danger-soft rounded-lg px-3.5 py-2.5">{error}</div>}
      </div>

      <div className="sticky bottom-0 bg-surface rounded-b-2xl px-6 py-4 border-t border-line flex items-center justify-end gap-2.5">
        <Button onClick={onClose}>No, go back</Button>
        <Button variant={invite ? "primary" : "secondary"} className={cx(!invite && "!bg-danger !text-white !border-danger hover:!opacity-90")} loading={busy} onClick={confirm}>
          {invite ? (send ? "Yes, send invitation" : "Yes, mark shortlisted") : send ? "Yes, send decline" : "Yes, mark declined"}
        </Button>
      </div>
    </Modal>
  );
}
