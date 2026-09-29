"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Loader2, ShieldCheck, UploadCloud } from "lucide-react";
import type { Decision, Role } from "@/lib/rubric";
import { Button, cx, DecisionBadge, Modal, ModalHeader, Segmented } from "./ui";

export interface UploadItem {
  key: string;
  file: File;
  role: Role;
  status: "queued" | "processing" | "done" | "error";
  error?: string;
  candidateId?: string;
  decision?: Decision | null;
  name?: string | null;
  startedAt?: number;
}

const ACCEPT = ".pdf,.docx,.txt";

export function UploadModal({ open, onClose, items, onAdd, onClear, onOpenCandidate }: {
  open: boolean; onClose: () => void; items: UploadItem[]; onAdd: (files: File[], role: Role) => void;
  onClear: () => void; onOpenCandidate: (id: string) => void;
}) {
  const [role, setRole] = useState<Role>("PM");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const take = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list).filter((f) => /\.(pdf|docx|txt)$/i.test(f.name));
    if (files.length) onAdd(files, role);
  };

  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "error").length;

  return (
    <Modal open={open} onClose={onClose} width="max-w-xl">
      <ModalHeader title="Upload CVs" subtitle="Each CV is scored for both PM and Senior PM; the role applied for decides which result leads." onClose={onClose} />
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-ink-2">Role applied for</span>
          <Segmented<Role> value={role} onChange={setRole} options={[{ value: "PM", label: "Product Manager" }, { value: "SPM", label: "Senior PM" }]} />
        </div>

        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files); }}
          className={cx(
            "w-full rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
            drag ? "border-accent bg-accent-soft/60" : "border-line-strong bg-surface-2 hover:border-accent/50",
          )}
        >
          <div className="size-11 mx-auto rounded-xl bg-surface border border-line grid place-items-center text-accent shadow-card"><UploadCloud className="size-5" /></div>
          <div className="mt-4 text-[14px] font-medium">Drop CVs here, or <span className="text-accent">browse</span></div>
          <div className="mt-1 text-[12.5px] text-muted">PDF, DOCX or TXT · up to 4 MB each · as many as you like</div>
          <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
        </button>

        <div className="flex items-start gap-2.5 text-[12px] text-muted bg-surface-2 border border-line rounded-xl px-3.5 py-3">
          <ShieldCheck className="size-4 text-accent shrink-0 mt-px" />
          <span>Name, email and phone are separated at ingestion. Scoring, briefs and drafts only ever see the redacted CV. College, employer brand and personal attributes carry zero weight.</span>
        </div>

        {items.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium text-ink-2">
                {done}/{items.length} scored{failed ? ` · ${failed} failed` : ""}
              </span>
              {(done > 0 || failed > 0) && <button onClick={onClear} className="text-[12px] text-muted hover:text-ink">Clear finished</button>}
            </div>
            <div className="max-h-72 overflow-y-auto scroll-thin rounded-xl border border-line divide-y divide-line">
              {items.map((i) => (
                <div key={i.key} className="flex items-center gap-3 px-3.5 h-12">
                  {i.status === "done" ? <CheckCircle2 className="size-4 text-accent" />
                    : i.status === "error" ? <AlertCircle className="size-4 text-danger" />
                      : i.status === "processing" ? <Loader2 className="size-4 text-accent animate-spin" />
                        : <FileText className="size-4 text-faint" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] truncate">{i.name || i.file.name}</div>
                    <div className={cx("text-[11.5px] truncate", i.status === "error" ? "text-danger" : "text-faint")}>
                      {i.status === "queued" && `Queued · ${i.role === "PM" ? "PM" : "Senior PM"}`}
                      {i.status === "processing" && "Extracting, redacting, scoring…"}
                      {i.status === "done" && i.file.name}
                      {i.status === "error" && i.error}
                    </div>
                  </div>
                  {i.status === "done" && i.candidateId && (
                    <button onClick={() => onOpenCandidate(i.candidateId!)} className="flex items-center gap-2">
                      <DecisionBadge decision={i.decision ?? null} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="px-6 py-4 border-t border-line flex items-center justify-between">
        <span className="text-[12px] text-faint">About 30–60 seconds per CV · 3 at a time</span>
        <Button onClick={onClose}>{items.some((i) => i.status === "processing" || i.status === "queued") ? "Keep working in background" : "Done"}</Button>
      </div>
    </Modal>
  );
}
