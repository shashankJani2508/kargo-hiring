"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { Candidate } from "@/lib/types";
import type { DecisionAction } from "./DecisionModal";
import { Avatar, Button, cx, DecisionBadge, Modal, ModalHeader } from "./ui";

type RowState = "pending" | "working" | "done" | "failed";

// One Yes for a whole group. Invites run one at a time so each gets its own free slot.
export function BulkModal({ list, action, onClose, onUpdated }: {
  list: Candidate[]; action: DecisionAction; onClose: () => void; onUpdated: (c: Candidate) => void;
}) {
  const invite = action === "invite";
  const [state, setState] = useState<Record<string, { s: RowState; msg?: string }>>({});
  const [running, setRunning] = useState(false);
  const finished = Object.values(state).filter((v) => v.s === "done" || v.s === "failed").length;
  const done = running === false && finished === list.length && finished > 0;

  async function go() {
    setRunning(true);
    for (const c of list) {
      setState((p) => ({ ...p, [c.id]: { s: "working" } }));
      try {
        const res = await fetch(`/api/candidates/${c.id}/decision`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed");
        onUpdated(json.candidate as Candidate);
        const when = invite && json.candidate?.interview?.scheduled_at
          ? new Date(json.candidate.interview.scheduled_at).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
          : undefined;
        setState((p) => ({ ...p, [c.id]: { s: "done", msg: when } }));
      } catch (e) {
        setState((p) => ({ ...p, [c.id]: { s: "failed", msg: (e as Error).message } }));
      }
    }
    setRunning(false);
  }

  return (
    <Modal open onClose={running ? () => {} : onClose} width="max-w-[560px]">
      <ModalHeader
        onClose={running ? () => {} : onClose}
        icon={<div className={cx("size-9 rounded-xl grid place-items-center shrink-0", invite ? "bg-accent-soft text-accent" : "bg-danger-soft text-danger")}>{invite ? <CheckCircle2 className="size-[18px]" /> : <XCircle className="size-[18px]" />}</div>}
        title={invite ? `Invite all ${list.length} recommended candidates?` : `Decline all ${list.length} candidates below the line?`}
        subtitle={invite
          ? "Each gets the next free slot in your calendar, an automatic Google Meet link, and their personal invitation."
          : "Each gets their personal, polite decline. No scores or reasons are shared."}
      />
      <div className="max-h-[50vh] overflow-y-auto scroll-thin divide-y divide-line">
        {list.map((c) => {
          const st = state[c.id];
          return (
            <div key={c.id} className="flex items-center gap-3 px-6 py-3">
              <Avatar name={c.name} size={32} />
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-medium truncate">{c.name ?? "Unnamed"}</div>
                <div className={cx("text-[12px] truncate", st?.s === "failed" ? "text-danger" : "text-muted")}>
                  {st?.s === "failed" ? st.msg : st?.s === "done" ? (invite ? `Invited · ${st.msg ?? ""}` : "Decline sent") : c.why_line}
                </div>
              </div>
              {st?.s === "working" ? <Loader2 className="size-4 animate-spin text-accent" />
                : st?.s === "done" ? <CheckCircle2 className="size-4 text-accent" />
                  : st?.s === "failed" ? <XCircle className="size-4 text-danger" />
                    : <DecisionBadge decision={c.decision} />}
            </div>
          );
        })}
      </div>
      <div className="px-6 py-4 border-t border-line flex items-center justify-end gap-2.5">
        {done ? (
          <Button variant="primary" onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={running} className="min-w-[96px]">No</Button>
            <Button variant={invite ? "primary" : "secondary"} className={cx("min-w-[96px]", !invite && "!bg-danger !text-white !border-danger hover:!opacity-90")} loading={running} onClick={go}>
              {running ? `${finished}/${list.length}` : "Yes"}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
