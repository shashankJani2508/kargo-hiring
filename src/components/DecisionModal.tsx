"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, Mail, Video, XCircle } from "lucide-react";
import { api, primaryEval } from "@/lib/client";
import { GATES, isShortlisted, ROLE_LABEL } from "@/lib/rubric";
import { formatSlot, personalise, renderEmail, type InterviewSlot } from "@/lib/email-render";
import type { Candidate } from "@/lib/types";
import type { Settings } from "@/lib/db";
import type { EmailInfo } from "./SettingsModal";
import { Button, cx, DecisionBadge, Field, inputCls, Modal, ModalHeader, textareaCls } from "./ui";

export type DecisionAction = "invite" | "decline";
type MeetMode = "auto" | "room" | "none";

// Arjun's whole job here is Yes or No. Time, Meet link and email are already prepared.
export function DecisionModal({ candidate: c, action, emailInfo, onClose, onDone }: {
  candidate: Candidate; action: DecisionAction; settings: Settings | null; emailInfo: EmailInfo | null;
  onClose: () => void; onDone: (c: Candidate, emailed: boolean) => void;
}) {
  const e = primaryEval(c);
  const role = c.primary_role ?? c.role_applied;
  const invite = action === "invite";
  const shortlisted = c.decision ? isShortlisted(c.decision) : false;
  const override = invite ? !shortlisted : shortlisted;

  const draft = invite ? c.invite_draft : c.decline_draft;
  const [subject, setSubject] = useState(personalise(draft?.subject ?? "", c.name, role));
  const [body, setBody] = useState(personalise(draft?.body ?? "", c.name, role));
  const [slot, setSlot] = useState<InterviewSlot | null>(null);
  const [meet, setMeet] = useState<MeetMode | null>(null);
  const [slotError, setSlotError] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!invite) return;
    api<{ slot: InterviewSlot; meet: MeetMode }>(`/api/schedule/next?exclude=${c.id}`)
      .then((r) => { setSlot(r.slot); setMeet(r.meet); })
      .catch((err: Error) => setSlotError(err.message));
  }, [invite, c.id]);

  const sends = !!emailInfo?.configured && !!c.email;
  const html = useMemo(() => {
    if (!showEmail) return "";
    const s = invite && slot ? { ...slot, meet_link: slot.meet_link || "https://meet.google.com/(created when you click Yes)" } : null;
    return renderEmail(body, s).html;
  }, [showEmail, body, invite, slot]);
  const when = slot ? formatSlot(slot) : null;
  const canConfirm = !busy && (!invite || (!!slot && meet !== "none"));

  async function confirm() {
    setError("");
    setBusy(true);
    try {
      const r = await api<{ candidate: Candidate; email: unknown }>(`/api/candidates/${c.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, subject, body, slot: invite && slot ? { date: slot.date, time: slot.time, duration_minutes: slot.duration_minutes } : undefined }),
      });
      onDone(r.candidate, !!r.email);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} width="max-w-[620px]">
      <ModalHeader
        onClose={onClose}
        icon={<div className={cx("size-9 rounded-xl grid place-items-center shrink-0", invite ? "bg-accent-soft text-accent" : "bg-danger-soft text-danger")}>{invite ? <CheckCircle2 className="size-[18px]" /> : <XCircle className="size-[18px]" />}</div>}
        title={invite ? `Invite ${c.name ?? "this candidate"} to interview?` : `Decline ${c.name ?? "this candidate"}?`}
        subtitle={ROLE_LABEL[role]}
      />

      <div className="p-6 space-y-4">
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
            </span>
          </div>
          {c.why_line && <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-2">{c.why_line}</p>}
          {(e?.failed_gates.length ?? 0) > 0 && (
            <p className="mt-2 text-[12.5px] text-ink-2">
              <span className="font-medium text-danger">Fails: </span>
              {e!.failed_gates.map((g) => `${GATES[g].name} — ${e!.gates[g].reason}`).join(" · ")}
            </p>
          )}
          <div className="mt-3 grid sm:grid-cols-2 gap-3 text-[12.5px] text-ink-2">
            <ul className="space-y-1">{(e?.strengths ?? []).slice(0, 2).map((s, i) => <li key={i} className="leading-snug"><span className="text-accent">+</span> {s}</li>)}</ul>
            <ul className="space-y-1">{(e?.gaps ?? []).slice(0, 2).map((s, i) => <li key={i} className="leading-snug"><span className="text-danger">−</span> {s}</li>)}</ul>
          </div>
        </div>

        {/* What will happen when Arjun says yes */}
        <div className="rounded-xl border border-line divide-y divide-line">
          {invite && (
            <div className="flex items-center gap-3 px-4 py-3">
              <CalendarClock className="size-4 text-accent shrink-0" />
              {slotError ? (
                <span className="text-[13px] text-danger">{slotError}</span>
              ) : when ? (
                <span className="text-[13.5px]"><span className="font-medium">{when.date}</span> · {when.time} · {when.duration}</span>
              ) : (
                <span className="h-3 w-56 rounded shimmer" />
              )}
              <span className="ml-auto text-[11.5px] text-faint whitespace-nowrap">next free slot</span>
            </div>
          )}
          {invite && (
            <div className="flex items-center gap-3 px-4 py-3">
              <Video className="size-4 text-accent shrink-0" />
              <span className={cx("text-[13.5px]", meet === "none" && "text-danger")}>
                {meet === "auto" ? "Google Meet link is created in your calendar automatically"
                  : meet === "room" ? "Your Google Meet room from Settings"
                    : meet === "none" ? "Connect Google Calendar in Settings once — Meet links are then automatic"
                      : "Checking your calendar…"}
              </span>
            </div>
          )}
          <div className="px-4 py-3">
            <button type="button" onClick={() => setShowEmail((s) => !s)} className="w-full flex items-center gap-3 text-left">
              <Mail className="size-4 text-accent shrink-0" />
              <span className="text-[13.5px] min-w-0 truncate">
                {sends
                  ? <>Email to {emailInfo?.override ? "your test inbox" : c.email} <span className="text-muted">· {subject}</span></>
                  : <span className="text-warn">{!c.email ? "No email on this CV — decision saved only" : "Email not connected — decision saved only"}</span>}
              </span>
              <ChevronDown className={cx("size-4 text-faint ml-auto shrink-0 transition", showEmail && "rotate-180")} />
            </button>
            {showEmail && (
              <div className="mt-3 space-y-3">
                <iframe title="Email preview" srcDoc={html} className="w-full h-[360px] rounded-lg border border-line bg-canvas" />
                <details className="text-[12.5px]">
                  <summary className="cursor-pointer text-muted hover:text-ink">Edit the email (optional)</summary>
                  <div className="mt-2 space-y-2">
                    <Field label="Subject"><input className={inputCls} value={subject} onChange={(ev) => setSubject(ev.target.value)} /></Field>
                    <Field label="Message"><textarea className={cx(textareaCls, "min-h-[180px]")} value={body} onChange={(ev) => setBody(ev.target.value)} /></Field>
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>

        {error && <div className="text-[13px] text-danger bg-danger-soft rounded-lg px-3.5 py-2.5">{error}</div>}
      </div>

      <div className="px-6 py-4 border-t border-line flex items-center justify-end gap-2.5">
        <Button onClick={onClose} className="min-w-[96px]">No</Button>
        <Button variant={invite ? "primary" : "secondary"} className={cx("min-w-[96px]", !invite && "!bg-danger !text-white !border-danger hover:!opacity-90")} loading={busy} disabled={!canConfirm} onClick={confirm}>
          Yes
        </Button>
      </div>
    </Modal>
  );
}
