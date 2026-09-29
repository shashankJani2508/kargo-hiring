"use client";

import { useEffect, type ReactNode } from "react";
import { X, Loader2 } from "lucide-react";
import type { Decision, Path } from "@/lib/rubric";
import type { Stage } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ---------- Decision / status tokens ----------

export const DECISION_STYLE: Record<Decision, { fg: string; bg: string; dot: string; label: string }> = {
  "Strong shortlist": { fg: "text-accent", bg: "bg-accent-soft", dot: "bg-gold", label: "Strong shortlist" },
  Shortlist: { fg: "text-accent", bg: "bg-accent-soft", dot: "bg-accent", label: "Shortlist" },
  "Conditional shortlist": { fg: "text-info", bg: "bg-info-soft", dot: "bg-info", label: "Conditional" },
  Hold: { fg: "text-warn", bg: "bg-warn-soft", dot: "bg-warn", label: "Hold" },
  Reject: { fg: "text-danger", bg: "bg-danger-soft", dot: "bg-danger", label: "Not shortlisted" },
  "Reject (gate)": { fg: "text-muted", bg: "bg-[#F0EFEB]", dot: "bg-faint", label: "Fails gate" },
  "Not eligible": { fg: "text-muted", bg: "bg-[#F0EFEB]", dot: "bg-faint", label: "Not eligible" },
  "Recommend PM role": { fg: "text-info", bg: "bg-info-soft", dot: "bg-info", label: "Offer PM role" },
};

export function DecisionBadge({ decision, size = "sm" }: { decision: Decision | null; size?: "sm" | "md" }) {
  if (!decision) return null;
  const s = DECISION_STYLE[decision];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        s.fg, s.bg,
        size === "sm" ? "h-6 px-2.5 text-[12px]" : "h-7 px-3 text-[13px]",
      )}
    >
      <span className={cx("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export const PATH_INFO: Record<Path, { label: string; hint: string }> = {
  A: { label: "Path A", hint: "Domain-native — V1 ≥ 3" },
  B: { label: "Path B", hint: "Customer-close — V1 ≤ 2, V2 ≥ 2" },
  C: { label: "Path C", hint: "Neither — V1 ≤ 2, V2 ≤ 1" },
};

export function PathChip({ path }: { path: Path | null }) {
  if (!path) return null;
  return (
    <span title={PATH_INFO[path].hint} className="inline-flex items-center h-6 px-2 rounded-md border border-line text-[11px] font-medium text-ink-2 bg-surface">
      {path}
    </span>
  );
}

export const STAGE_STYLE: Record<Stage, { label: string; cls: string }> = {
  new: { label: "Awaiting decision", cls: "text-ink-2 bg-surface-2 border-line" },
  invited: { label: "Invited", cls: "text-accent bg-accent-soft border-transparent" },
  interviewed: { label: "Interviewed", cls: "text-info bg-info-soft border-transparent" },
  offer: { label: "Offer", cls: "text-gold bg-gold-soft border-transparent" },
  declined: { label: "Declined", cls: "text-muted bg-[#F0EFEB] border-transparent" },
  closed: { label: "Closed", cls: "text-muted bg-[#F0EFEB] border-transparent" },
};

export function StageChip({ stage }: { stage: Stage }) {
  const s = STAGE_STYLE[stage];
  return <span className={cx("inline-flex items-center h-6 px-2 rounded-md border text-[11.5px] font-medium whitespace-nowrap", s.cls)}>{s.label}</span>;
}

export function ScoreBar({ value, decision }: { value: number | null; decision: Decision | null }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const color =
    decision === "Strong shortlist" || decision === "Shortlist" ? "bg-accent"
      : decision === "Conditional shortlist" || decision === "Recommend PM role" ? "bg-info"
        : decision === "Hold" ? "bg-warn" : "bg-line-strong";
  return (
    <div className="flex items-center gap-3 min-w-[120px]">
      <span className="tnum text-[15px] font-semibold w-11 text-right">{value == null ? "—" : fmtScore(v)}</span>
      <div className="h-1.5 flex-1 rounded-full bg-[#EFEDE8] overflow-hidden">
        <div className={cx("h-full rounded-full", color)} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function ScoreRing({ value, decision, size = 88 }: { value: number; decision: Decision | null; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const stroke =
    decision === "Strong shortlist" || decision === "Shortlist" ? "var(--accent)"
      : decision === "Conditional shortlist" || decision === "Recommend PM role" ? "var(--info)"
        : decision === "Hold" ? "var(--warn)" : "var(--faint)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#EFEDE8" strokeWidth={6} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={stroke} strokeWidth={6} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * Math.min(100, value)) / 100} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="tnum text-[22px] font-semibold leading-none tracking-tight">{fmtScore(value)}</div>
          <div className="text-[10px] text-faint mt-1">of 100</div>
        </div>
      </div>
    </div>
  );
}

export const fmtScore = (v: number) => String(Math.round(v * 100) / 100);

export function Dots({ score, max = 4 }: { score: number; max?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={cx("h-1.5 w-5 rounded-full", i < score ? "bg-accent" : "bg-[#EAE7E0]")} />
      ))}
    </div>
  );
}

export function ConfidenceChip({ c }: { c: string }) {
  const cls = c === "High" ? "text-accent" : c === "Medium" ? "text-ink-2" : "text-warn";
  return <span className={cx("text-[11px] font-medium", cls)}>{c} confidence</span>;
}

// ---------- Primitives ----------

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export function Button({
  variant = "secondary", size = "md", className, loading, children, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md"; loading?: boolean }) {
  const v = {
    primary: "bg-accent text-white hover:bg-accent-hover shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]",
    secondary: "bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-2",
    ghost: "text-ink-2 hover:bg-[#EFEDE8]",
    danger: "bg-surface text-danger border border-line hover:border-danger/30 hover:bg-danger-soft",
  }[variant];
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
        v, className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Modal({ open, onClose, children, width = "max-w-2xl" }: { open: boolean; onClose: () => void; children: ReactNode; width?: string }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="fixed inset-0 bg-[#0B0D12]/40 animate-fade-in" onClick={onClose} />
      <div className={cx("relative w-full bg-surface rounded-2xl shadow-pop border border-line animate-pop-in my-auto", width)}>{children}</div>
    </div>
  );
}

export function ModalHeader({ title, subtitle, onClose, icon }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; icon?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-6 pt-5 pb-4 border-b border-line">
      {icon}
      <div className="flex-1 min-w-0">
        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-[13px] text-muted mt-0.5">{subtitle}</p>}
      </div>
      <button onClick={onClose} className="size-8 -mr-2 rounded-lg grid place-items-center text-muted hover:bg-[#EFEDE8]" aria-label="Close">
        <X className="size-4" />
      </button>
    </div>
  );
}

export function useEscape(active: boolean, fn: () => void) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && fn();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [active, fn]);
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="block text-[12px] font-medium text-ink-2 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11.5px] text-faint mt-1">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full h-10 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition placeholder:text-faint";
export const textareaCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition placeholder:text-faint";

export function Segmented<T extends string>({ value, onChange, options, size = "md" }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; count?: number }[]; size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex p-0.5 rounded-lg bg-[#EFEDE8] border border-line">
      {options.map((o) => (
        <button
          key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cx(
            "rounded-md font-medium transition flex items-center gap-1.5",
            size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-8 px-3 text-[13px]",
            value === o.value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
          {o.count != null && <span className={cx("tnum text-[11px]", value === o.value ? "text-muted" : "text-faint")}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">{children}</h3>
      {right}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-xl border border-line bg-surface shadow-card", className)}>{children}</div>;
}

export function initials(name: string | null) {
  const p = (name ?? "?").trim().split(/\s+/);
  return ((p[0]?.[0] ?? "?") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ name, size = 36 }: { name: string | null; size?: number }) {
  const palette = ["#E4EFE9", "#EAF0F8", "#F6EFE2", "#F1ECF4", "#EEF0EC"];
  const fg = ["#1E4D3F", "#3A5A86", "#8A6A35", "#5E4A70", "#4A5548"];
  const i = [...(name ?? "")].reduce((a, ch) => a + ch.charCodeAt(0), 0) % palette.length;
  return (
    <div className="rounded-full grid place-items-center font-semibold shrink-0"
      style={{ width: size, height: size, background: palette[i], color: fg[i], fontSize: size * 0.36 }}>
      {initials(name)}
    </div>
  );
}

export function relTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(d);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 3600_000) return rtf.format(Math.round(d / 60_000), "minute");
  if (abs < 86400_000) return rtf.format(Math.round(d / 3600_000), "hour");
  return rtf.format(Math.round(d / 86400_000), "day");
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}
