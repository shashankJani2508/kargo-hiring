"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "@/lib/client";
import type { Settings } from "@/lib/db";
import { Button, Field, inputCls, Modal, ModalHeader } from "./ui";

export interface EmailInfo {
  configured: boolean;
  from: string | null;
  override: string | null;
}

export function SettingsModal({ open, onClose, settings, emailInfo, onSaved }: {
  open: boolean; onClose: () => void; settings: Settings | null; emailInfo: EmailInfo | null; onSaved: (s: Settings) => void;
}) {
  const [form, setForm] = useState<Settings | null>(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function save() {
    if (!form) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ settings: Settings }>("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      onSaved(r.settings);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} width="max-w-lg">
      <ModalHeader title="Settings" subtitle="Defaults used when you invite a candidate." onClose={onClose} />
      {!form ? (
        <div className="p-6 text-sm text-muted">Settings are unavailable until the database is connected.</div>
      ) : (
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Interviewer"><input className={inputCls} value={form.interviewer_name} onChange={(e) => set("interviewer_name", e.target.value)} /></Field>
            <Field label="Title"><input className={inputCls} value={form.interviewer_title} onChange={(e) => set("interviewer_title", e.target.value)} /></Field>
          </div>
          <Field label="Default Google Meet link" hint="Pre-filled on every invite; you can change it per candidate.">
            <input className={inputCls} value={form.meet_link} onChange={(e) => set("meet_link", e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Default duration">
              <select className={inputCls} value={form.duration_minutes} onChange={(e) => set("duration_minutes", Number(e.target.value))}>
                {[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}
              </select>
            </Field>
            <Field label="Reply-to email" hint="Where candidate replies land.">
              <input className={inputCls} value={form.reply_to} onChange={(e) => set("reply_to", e.target.value)} placeholder="arjun@kargo.in" />
            </Field>
          </div>

          <div className="rounded-xl border border-line bg-surface-2 p-4 text-[12.5px]">
            <div className="flex items-center gap-2 font-medium text-[13px]">
              {emailInfo?.configured ? <CheckCircle2 className="size-4 text-accent" /> : <AlertTriangle className="size-4 text-warn" />}
              Resend {emailInfo?.configured ? "connected" : "not connected"}
            </div>
            <div className="mt-1.5 text-muted space-y-0.5">
              <div>From: {emailInfo?.from ?? "Kargo Hiring <onboarding@resend.dev>"}</div>
              {emailInfo?.override && <div className="text-warn">Test mode: every email is redirected to {emailInfo.override}</div>}
              {!emailInfo?.configured && <div>Add RESEND_API_KEY (and EMAIL_FROM on a verified domain) in Vercel, then redeploy.</div>}
            </div>
          </div>
          {error && <div className="text-[13px] text-danger">{error}</div>}
        </div>
      )}
      <div className="px-6 py-4 border-t border-line flex justify-end gap-2.5">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={busy} disabled={!form} onClick={save}>Save settings</Button>
      </div>
    </Modal>
  );
}
