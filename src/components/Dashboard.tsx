"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CalendarClock, Check, ChevronRight, Clock, FileUp, Inbox, LayoutList, Mail,
  RefreshCw, Search, Settings as SettingsIcon, Sparkles, Users, Video, X,
} from "lucide-react";
import { api, bucket, due, primaryEval, rankCandidates } from "@/lib/client";
import { ROLE_LABEL, type Role } from "@/lib/rubric";
import type { Candidate, Stage } from "@/lib/types";
import type { Settings } from "@/lib/db";
import {
  Avatar, Button, Card, cx, DecisionBadge, fmtDateTime, PathChip, relTime, ScoreBar, Segmented, StageChip,
} from "./ui";
import { CandidateDrawer, type DrawerTab } from "./CandidateDrawer";
import { DecisionModal, type DecisionAction } from "./DecisionModal";
import { UploadModal, type UploadItem } from "./UploadModal";
import { SettingsModal, type EmailInfo, type GoogleInfo } from "./SettingsModal";
import { BulkModal } from "./BulkModal";

type View = "pipeline" | "interviews";
type RoleFilter = "all" | Role;
type StageFilter = "all" | Stage;

const CONCURRENCY = 5;

export default function Dashboard() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>("pipeline");
  const [role, setRole] = useState<RoleFilter>("all");
  const [stage, setStage] = useState<StageFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ id: string; tab: DrawerTab } | null>(null);
  const [decision, setDecision] = useState<{ id: string; action: DecisionAction } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [emailInfo, setEmailInfo] = useState<EmailInfo | null>(null);
  const [google, setGoogle] = useState<GoogleInfo | null>(null);
  const [bulk, setBulk] = useState<{ ids: string[]; action: DecisionAction } | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  const notify = useCallback((text: string, tone: "ok" | "err" = "ok") => {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const load = useCallback(async () => {
    try {
      const { candidates } = await api<{ candidates: Candidate[] }>("/api/candidates");
      setCandidates(candidates);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    load();
    const loadSettings = () =>
      api<{ settings: Settings; email: EmailInfo; google: GoogleInfo }>("/api/settings")
        .then((r) => { setSettings(r.settings); setEmailInfo(r.email); setGoogle(r.google); })
        .catch(() => {});
    loadSettings();
    const onFocus = () => { load(); loadSettings(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("google");
    if (!g) return;
    window.history.replaceState(null, "", "/");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off message after the Google redirect
    notify(g === "connected" ? "Google Calendar connected — Meet links are now automatic" : "Google Calendar wasn't connected", g === "connected" ? "ok" : "err");
  }, [notify]);

  const upsert = useCallback((c: Candidate) => {
    setCandidates((prev) => {
      const i = prev.findIndex((p) => p.id === c.id);
      if (i === -1) return [c, ...prev];
      const next = prev.slice();
      next[i] = c;
      return next;
    });
  }, []);

  // ---------- Upload queue ----------
  const running = useRef(new Set<string>());
  useEffect(() => {
    const active = uploads.filter((u) => u.status === "processing").length;
    const queued = uploads.filter((u) => u.status === "queued" && !running.current.has(u.key));
    for (const u of queued.slice(0, Math.max(0, CONCURRENCY - active))) {
      running.current.add(u.key);
      setUploads((prev) => prev.map((p) => (p.key === u.key ? { ...p, status: "processing", startedAt: Date.now() } : p)));
      const fd = new FormData();
      fd.append("file", u.file);
      fd.append("role", u.role);
      fetch("/api/candidates", { method: "POST", body: fd })
        .then(async (res) => {
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);
          const c = json.candidate as Candidate;
          upsert(c);
          setUploads((prev) => prev.map((p) => (p.key === u.key ? { ...p, status: "done", candidateId: c.id, decision: c.decision, name: c.name } : p)));
        })
        .catch((e: Error) => {
          setUploads((prev) => prev.map((p) => (p.key === u.key ? { ...p, status: "error", error: e.message } : p)));
          load();
        })
        .finally(() => running.current.delete(u.key));
    }
  }, [uploads, upsert, load]);

  const addFiles = (files: File[], r: Role) => {
    setUploads((prev) => [
      ...prev.filter((p) => p.status !== "done" && p.status !== "error"),
      ...files.map((file) => ({ key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, file, role: r, status: "queued" as const })),
    ]);
  };
  const uploading = uploads.filter((u) => u.status === "queued" || u.status === "processing").length;

  // ---------- Derived ----------
  const { ordered, ranks } = useMemo(() => rankCandidates(candidates), [candidates]);
  const pending = candidates.filter((c) => c.status !== "ready");

  const matches = useCallback(
    (c: Candidate) => {
      if (role !== "all" && (c.primary_role ?? c.role_applied) !== role) return false;
      if (stage !== "all" && c.stage !== stage) return false;
      if (query) {
        const q = query.toLowerCase();
        const e = primaryEval(c);
        const hay = [c.name, c.email, c.file_name, e?.one_line_profile, e?.archetype].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    },
    [role, stage, query],
  );
  const visible = ordered.filter(matches);
  const groups = {
    recommended: visible.filter((c) => bucket(c) === "recommended"),
    hold: visible.filter((c) => bucket(c) === "hold"),
    not_recommended: visible.filter((c) => bucket(c) === "not_recommended"),
  };

  const inRole = (c: Candidate) => role === "all" || (c.primary_role ?? c.role_applied) === role;
  const scoped = ordered.filter(inRole);
  const kpi = {
    total: candidates.filter(inRole).length,
    thisWeek: candidates.filter((c) => inRole(c) && now - new Date(c.created_at).getTime() < 7 * 86400_000).length,
    recommended: scoped.filter((c) => bucket(c) === "recommended").length,
    strong: scoped.filter((c) => c.decision === "Strong shortlist").length,
    awaiting: scoped.filter((c) => c.stage === "new").length,
    overdue: scoped.filter((c) => due(c)?.overdue).length,
    interviews: scoped.filter((c) => c.stage === "invited" && c.interview && new Date(c.interview.scheduled_at).getTime() > now).length,
    sent: scoped.reduce((n, c) => n + c.email_log.filter((l) => l.status === "sent").length, 0),
  };
  const stageCounts = (s: StageFilter) => (s === "all" ? scoped.length : scoped.filter((c) => c.stage === s).length);

  const selectedCandidate = selected ? candidates.find((c) => c.id === selected.id) ?? null : null;
  const decisionCandidate = decision ? candidates.find((c) => c.id === decision.id) ?? null : null;

  async function rescore(id: string) {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, status: "processing", error: null } : c)));
    try {
      const { candidate } = await api<{ candidate: Candidate }>(`/api/candidates/${id}/rescore`, { method: "POST" });
      upsert(candidate);
      notify("Candidate re-scored");
    } catch (e) {
      notify((e as Error).message, "err");
      load();
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this candidate and their CV from the dashboard? This can't be undone.")) return;
    await api(`/api/candidates/${id}`, { method: "DELETE" });
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    setSelected(null);
    notify("Candidate removed");
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-[232px] shrink-0 flex-col bg-sidebar text-white/80 sticky top-0 h-screen">
        <div className="px-5 h-16 flex items-center gap-2.5 border-b border-white/[0.06]">
          <div className="size-7 rounded-lg bg-white text-ink grid place-items-center text-[13px] font-bold">K</div>
          <span className="text-[14.5px] font-semibold text-white tracking-tight">Kargo <span className="font-normal text-white/40">Hiring</span></span>
        </div>
        <nav className="p-3 space-y-0.5">
          <NavItem icon={<LayoutList className="size-4" />} active={view === "pipeline"} onClick={() => setView("pipeline")} label="Pipeline" count={candidates.length} />
          <NavItem icon={<CalendarClock className="size-4" />} active={view === "interviews"} onClick={() => setView("interviews")} label="Interviews"
            count={candidates.filter((c) => c.stage === "invited" || c.stage === "interviewed" || c.stage === "offer").length} />
          <NavItem icon={<SettingsIcon className="size-4" />} onClick={() => setSettingsOpen(true)} label="Settings" />
        </nav>
        <div className="mt-auto p-4 space-y-3">
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3.5">
            <div className="flex items-center gap-2 text-[12px] text-white/70"><Sparkles className="size-3.5 text-gold" /> Rubric v3</div>
            <p className="text-[11.5px] leading-relaxed text-white/40 mt-1.5">Ranked by resemblance to your best hires. The system recommends — you decide.</p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-canvas/85 backdrop-blur border-b border-line">
          <div className="max-w-[1320px] mx-auto px-4 sm:px-8 h-16 flex items-center gap-3">
            <div className="md:hidden size-7 rounded-lg bg-ink text-white grid place-items-center text-[13px] font-bold">K</div>
            <div className="min-w-0">
              <h1 className="text-[17px] font-semibold tracking-tight truncate">{view === "pipeline" ? "Hiring pipeline" : "Interviews"}</h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 h-9 w-64 rounded-lg border border-line bg-surface px-3 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10">
                <Search className="size-4 text-faint" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search candidates" className="flex-1 bg-transparent outline-none text-[13px]" />
              </div>
              <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setSettingsOpen(true)} aria-label="Settings"><SettingsIcon className="size-4" /></Button>
              <Button variant="primary" onClick={() => setUploadOpen(true)}>
                <FileUp className="size-4" /> Upload CVs
                {uploading > 0 && <span className="ml-1 tnum text-[11px] bg-white/15 rounded px-1.5 py-0.5">{uploading}</span>}
              </Button>
            </div>
          </div>
        </header>

        <div className="max-w-[1320px] mx-auto px-4 sm:px-8 py-7 space-y-6">
          {loadError && <SetupNotice message={loadError} />}

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Kpi label="Applications" value={kpi.total} sub={`${kpi.thisWeek} this week`} icon={<Users className="size-4" />} />
            <Kpi label="Recommended" value={kpi.recommended} sub={`${kpi.strong} strong shortlist`} icon={<Sparkles className="size-4" />} tone="accent" />
            <Kpi label="Awaiting your call" value={kpi.awaiting} sub={kpi.overdue ? `${kpi.overdue} past time limit` : "All within time limits"} icon={<Clock className="size-4" />} tone={kpi.overdue ? "warn" : undefined} />
            <Kpi label="Upcoming interviews" value={kpi.interviews} sub="Invites sent" icon={<Video className="size-4" />} />
            <Kpi label="Emails sent" value={kpi.sent} sub="Invites & declines" icon={<Mail className="size-4" />} className="col-span-2 lg:col-span-1" />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Segmented<RoleFilter>
              value={role} onChange={setRole}
              options={[
                { value: "all", label: "All roles" },
                { value: "PM", label: "Product Manager" },
                { value: "SPM", label: "Senior PM" },
              ]}
            />
            {view === "pipeline" && (
              <Segmented<StageFilter>
                size="sm" value={stage} onChange={setStage}
                options={[
                  { value: "all", label: "All", count: stageCounts("all") },
                  { value: "new", label: "Awaiting", count: stageCounts("new") },
                  { value: "invited", label: "Invited", count: stageCounts("invited") },
                  { value: "interviewed", label: "Interviewed", count: stageCounts("interviewed") },
                  { value: "declined", label: "Declined", count: stageCounts("declined") },
                ]}
              />
            )}
            <div className="sm:hidden w-full flex items-center gap-2 h-9 rounded-lg border border-line bg-surface px-3">
              <Search className="size-4 text-faint" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search candidates" className="flex-1 bg-transparent outline-none text-[13px]" />
            </div>
          </div>

          {view === "pipeline" ? (
            <>
              {pending.filter(inRole).length > 0 && (
                <Card className="divide-y divide-line">
                  {pending.filter(inRole).map((c) => (
                    <div key={c.id} className="flex items-center gap-4 px-5 h-14">
                      {c.status === "processing" ? (
                        <>
                          <div className="size-8 rounded-full shimmer" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium truncate">{c.file_name}</div>
                            <div className="text-[12px] text-muted">Reading and scoring against the rubric…</div>
                          </div>
                          <div className="h-2 w-40 rounded-full shimmer" />
                        </>
                      ) : (
                        <>
                          <div className="size-8 rounded-full bg-danger-soft text-danger grid place-items-center"><AlertTriangle className="size-4" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium truncate">{c.file_name}</div>
                            <div className="text-[12px] text-danger truncate">{c.error}</div>
                          </div>
                          <Button size="sm" onClick={() => rescore(c.id)}><RefreshCw className="size-3.5" /> Retry</Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><X className="size-3.5" /></Button>
                        </>
                      )}
                    </div>
                  ))}
                </Card>
              )}

              {loading ? (
                <SkeletonTable />
              ) : ordered.length === 0 && pending.length === 0 ? (
                <EmptyState onUpload={() => setUploadOpen(true)} />
              ) : (
                <div className="space-y-6">
                  <Group
                    title="Recommended for interview" hint="Above the line — ranked by the rubric"
                    bulk={{ label: "Invite all", action: "invite", onRun: (ids) => setBulk({ ids, action: "invite" }) }}
                    list={groups.recommended} ranks={ranks} tone="accent"
                    onOpen={(id) => setSelected({ id, tab: "overview" })} onDecide={(id, action) => setDecision({ id, action })}
                  />
                  <Group
                    title="On hold" hint="Path A, 50–64 — revisit weekly"
                    list={groups.hold} ranks={ranks} tone="warn"
                    onOpen={(id) => setSelected({ id, tab: "overview" })} onDecide={(id, action) => setDecision({ id, action })}
                  />
                  <Group
                    title="Not shortlisted" hint="Below the line — look once, then confirm the decline"
                    bulk={{ label: "Decline all", action: "decline", onRun: (ids) => setBulk({ ids, action: "decline" }) }}
                    list={groups.not_recommended} ranks={ranks} tone="muted"
                    onOpen={(id) => setSelected({ id, tab: "overview" })} onDecide={(id, action) => setDecision({ id, action })}
                  />
                  {visible.length === 0 && <p className="text-center text-sm text-muted py-10">No candidates match these filters.</p>}
                </div>
              )}
            </>
          ) : (
            <InterviewsView list={ordered.filter(inRole)} onOpen={(id, tab) => setSelected({ id, tab })} />
          )}
        </div>
      </main>

      {selectedCandidate && (
        <CandidateDrawer
          candidate={selectedCandidate}
          rank={ranks.get(selectedCandidate.id) ?? null}
          initialTab={selected!.tab}
          onClose={() => setSelected(null)}
          onDecide={(action) => setDecision({ id: selectedCandidate.id, action })}
          onUpdated={upsert}
          onRescore={() => rescore(selectedCandidate.id)}
          onRemove={() => remove(selectedCandidate.id)}
          notify={notify}
        />
      )}

      {decisionCandidate && decision && (
        <DecisionModal
          candidate={decisionCandidate}
          action={decision.action}
          settings={settings}
          emailInfo={emailInfo}
          onClose={() => setDecision(null)}
          onDone={(c, emailed) => {
            upsert(c);
            setDecision(null);
            notify(
              decision.action === "invite"
                ? emailed ? `Invitation sent to ${c.name ?? "candidate"}` : "Marked as shortlisted"
                : emailed ? `Decline sent to ${c.name ?? "candidate"}` : "Marked as declined",
            );
          }}
        />
      )}

      <UploadModal
        open={uploadOpen} onClose={() => setUploadOpen(false)} items={uploads} onAdd={addFiles}
        onClear={() => setUploads((prev) => prev.filter((p) => p.status === "queued" || p.status === "processing"))}
        onOpenCandidate={(id) => { setUploadOpen(false); setSelected({ id, tab: "overview" }); }}
      />

      {settingsOpen && <SettingsModal
        open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} emailInfo={emailInfo} google={google}
        onGoogleChange={setGoogle}
        onSaved={(s) => { setSettings(s); notify("Settings saved"); }}
      />}

      {bulk && (
        <BulkModal
          list={bulk.ids.map((id) => candidates.find((c) => c.id === id)).filter((c): c is Candidate => !!c)}
          action={bulk.action}
          onClose={() => setBulk(null)}
          onUpdated={upsert}
        />
      )}

      {!uploadOpen && uploading > 0 && (
        <button onClick={() => setUploadOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-full bg-ink text-white pl-3 pr-4 h-11 shadow-pop animate-pop-in">
          <span className="size-5 rounded-full border-2 border-white/25 border-t-white animate-spin" />
          <span className="text-[13px]">Scoring {uploading} CV{uploading > 1 ? "s" : ""}…</span>
        </button>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] animate-pop-in">
          <div className={cx("flex items-center gap-2.5 rounded-xl px-4 h-11 shadow-pop text-[13px]", toast.tone === "ok" ? "bg-ink text-white" : "bg-danger text-white")}>
            {toast.tone === "ok" ? <Check className="size-4 text-[#9FD3BE]" /> : <AlertTriangle className="size-4" />}
            {toast.text}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Pieces ----------

function NavItem({ icon, label, active, onClick, count }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void; count?: number }) {
  return (
    <button onClick={onClick}
      className={cx("w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[13.5px] transition",
        active ? "bg-white/[0.08] text-white" : "text-white/55 hover:text-white hover:bg-white/[0.04]")}>
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {count != null && <span className="tnum text-[11.5px] text-white/35">{count}</span>}
    </button>
  );
}

function Kpi({ label, value, sub, icon, tone, className }: { label: string; value: number; sub: string; icon: React.ReactNode; tone?: "accent" | "warn"; className?: string }) {
  return (
    <Card className={cx("p-4", className)}>
      <div className="flex items-center justify-between text-muted">
        <span className="text-[12px] font-medium">{label}</span>
        <span className={cx("size-7 rounded-lg grid place-items-center", tone === "accent" ? "bg-accent-soft text-accent" : tone === "warn" ? "bg-warn-soft text-warn" : "bg-surface-2 text-faint border border-line")}>{icon}</span>
      </div>
      <div className="tnum text-[28px] font-semibold tracking-tight mt-2 leading-none">{value}</div>
      <div className={cx("text-[12px] mt-2", tone === "warn" ? "text-warn" : "text-faint")}>{sub}</div>
    </Card>
  );
}

function Group({ title, hint, list, ranks, tone, onOpen, onDecide, bulk }: {
  title: string; hint: string; list: Candidate[]; ranks: Map<string, number>; tone: "accent" | "warn" | "muted";
  onOpen: (id: string) => void; onDecide: (id: string, a: DecisionAction) => void;
  bulk?: { label: string; action: DecisionAction; onRun: (ids: string[]) => void };
}) {
  if (list.length === 0) return null;
  // Conditional shortlists are interviewed only if Path A doesn't fill the slots, so bulk invite skips them.
  const pendingIds = list
    .filter((c) => c.stage === "new" && !(bulk?.action === "invite" && c.decision === "Conditional shortlist"))
    .map((c) => c.id);
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-2.5 px-1">
        <span className={cx("size-2 rounded-full translate-y-[-1px]", tone === "accent" ? "bg-accent" : tone === "warn" ? "bg-warn" : "bg-line-strong")} />
        <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
        <span className="tnum text-[13px] text-faint">{list.length}</span>
        <span className="hidden sm:inline text-[12.5px] text-faint">· {hint}</span>
        {bulk && pendingIds.length > 0 && (
          <button onClick={() => bulk.onRun(pendingIds)}
            className={cx("ml-auto h-8 px-3 rounded-lg text-[12.5px] font-medium flex items-center gap-1.5 transition self-center",
              bulk.action === "invite" ? "bg-accent text-white hover:bg-accent-hover" : "border border-line bg-surface text-ink-2 hover:text-danger hover:border-danger/30 hover:bg-danger-soft")}>
            {bulk.action === "invite" ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            {bulk.label} <span className="tnum opacity-70">{pendingIds.length}</span>
          </button>
        )}
      </div>
      <Card className="overflow-hidden">
        <div className={cx(GRID, "hidden lg:grid px-5 h-10 border-b border-line bg-surface-2 text-[11px] font-medium uppercase tracking-[0.08em] text-faint")}>
          <span>#</span><span>Candidate</span><span>Rubric score</span><span>Recommendation</span><span>Status</span><span className="text-right">Your call</span>
        </div>
        <div className="divide-y divide-line">
          {list.map((c) => <Row key={c.id} c={c} rank={ranks.get(c.id) ?? null} onOpen={() => onOpen(c.id)} onDecide={(a) => onDecide(c.id, a)} />)}
        </div>
      </Card>
    </section>
  );
}

const GRID = "lg:grid-cols-[24px_minmax(0,1fr)_136px_128px_116px_112px] xl:grid-cols-[32px_minmax(0,1fr)_160px_140px_124px_120px] 2xl:grid-cols-[36px_minmax(0,1fr)_190px_150px_136px_176px] items-center gap-x-4";

function Row({ c, rank, onOpen, onDecide }: { c: Candidate; rank: number | null; onOpen: () => void; onDecide: (a: DecisionAction) => void }) {
  const e = primaryEval(c)!;
  const d = due(c);
  const decided = c.stage !== "new";
  const roleLabel = c.primary_role === "SPM" ? "Senior PM" : "PM";
  return (
    <div onClick={onOpen}
      className={cx(GRID, "group grid grid-cols-[1fr_auto] gap-y-2 px-5 py-3.5 cursor-pointer hover:bg-surface-2 transition")}>
      <span className="hidden lg:block tnum text-[13px] font-medium text-faint">{rank}</span>
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={c.name} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[14px] font-medium truncate">{c.name ?? "Unnamed candidate"}</span>
            {e.tenure_flag && <span title="Tenure flag" className="shrink-0 text-[10.5px] font-medium text-warn bg-warn-soft rounded px-1.5 py-px">Tenure</span>}
          </div>
          <div className="text-[12.5px] text-muted truncate mt-0.5">
            <span className="font-medium text-ink-2">{roleLabel}</span>
            {c.primary_role !== c.role_applied && <span className="text-info"> (applied {c.role_applied === "SPM" ? "Senior PM" : "PM"})</span>}
            <span className="text-faint"> · </span>{e.one_line_profile}
          </div>
        </div>
      </div>
      <div className="lg:hidden flex items-center gap-2 justify-end"><DecisionBadge decision={c.decision} /></div>
      <div className="hidden lg:flex items-center gap-2"><ScoreBar value={c.total} decision={c.decision} /><PathChip path={c.path} /></div>
      <div className="hidden lg:block"><DecisionBadge decision={c.decision} /></div>
      <div className="hidden lg:block">
        <StageChip stage={c.stage} />
        {d && <div className={cx("text-[11px] mt-1", d.overdue ? "text-danger" : "text-faint")}>{d.overdue ? "Past time limit" : `Reply ${relTime(d.date.toISOString())}`}</div>}
      </div>
      <div className="col-span-2 lg:col-span-1 flex items-center justify-between lg:justify-end gap-1.5" onClick={(ev) => ev.stopPropagation()}>
        <span className="lg:hidden tnum text-[12.5px] text-muted">#{rank} · {c.total} / 100 · Path {c.path}</span>
        {decided ? (
          <button onClick={onOpen} className="text-[12.5px] text-muted hover:text-ink flex items-center gap-1">View <ChevronRight className="size-3.5" /></button>
        ) : (
          <>
            <button onClick={() => onDecide("decline")} title="Decline"
              className="h-8 px-2.5 rounded-lg border border-line bg-surface text-[12.5px] text-muted hover:text-danger hover:border-danger/30 hover:bg-danger-soft transition flex items-center gap-1">
              <X className="size-3.5" /> <span className="hidden 2xl:inline">Decline</span>
            </button>
            <button onClick={() => onDecide("invite")} title="Invite to interview"
              className="h-8 px-2.5 rounded-lg bg-accent text-white text-[12.5px] hover:bg-accent-hover transition flex items-center gap-1">
              <Check className="size-3.5" /> Invite
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function InterviewsView({ list, onOpen }: { list: Candidate[]; onOpen: (id: string, tab: DrawerTab) => void }) {
  const items = list
    .filter((c) => c.interview && (c.stage === "invited" || c.stage === "interviewed" || c.stage === "offer" || c.interview_feedback))
    .sort((a, b) => new Date(a.interview!.scheduled_at).getTime() - new Date(b.interview!.scheduled_at).getTime());
  const upcoming = items.filter((c) => !c.interview_feedback);
  const done = items.filter((c) => c.interview_feedback);
  if (items.length === 0) {
    return (
      <Card className="py-16 text-center">
        <CalendarClock className="size-6 mx-auto text-faint" />
        <p className="mt-3 text-sm font-medium">No interviews yet</p>
        <p className="text-[13px] text-muted mt-1">Candidates you invite appear here with their time, Meet link and interview brief.</p>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      {[{ title: "Scheduled", list: upcoming }, { title: "Interview brief logged", list: done }].map((g) =>
        g.list.length ? (
          <section key={g.title}>
            <div className="flex items-baseline gap-3 mb-2.5 px-1">
              <h2 className="text-[14px] font-semibold tracking-tight">{g.title}</h2>
              <span className="tnum text-[13px] text-faint">{g.list.length}</span>
            </div>
            <Card className="divide-y divide-line">
              {g.list.map((c) => {
                const when = new Date(c.interview!.scheduled_at);
                const past = when.getTime() < Date.now();
                const fb = c.interview_feedback;
                return (
                  <div key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <div className="w-14 text-center shrink-0">
                      <div className="text-[11px] uppercase tracking-wide text-faint">{when.toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" })}</div>
                      <div className="tnum text-[22px] font-semibold leading-tight">{when.toLocaleDateString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" })}</div>
                    </div>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar name={c.name} />
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium truncate">{c.name}</div>
                        <div className="text-[12.5px] text-muted">{ROLE_LABEL[c.primary_role ?? "PM"]} · {fmtDateTime(c.interview!.scheduled_at)} IST</div>
                      </div>
                    </div>
                    {fb ? (
                      <div className="text-right">
                        <div className="text-[13px] font-medium">{fb.outcome} · {"★".repeat(fb.rating)}<span className="text-line-strong">{"★".repeat(5 - fb.rating)}</span></div>
                        <div className="tnum text-[12px] text-muted">CV {c.total} → post-interview {fb.adjusted_total}</div>
                      </div>
                    ) : (
                      <a href={c.interview!.meet_link} target="_blank" rel="noreferrer" className="h-8 px-3 rounded-lg border border-line bg-surface text-[12.5px] flex items-center gap-1.5 hover:bg-surface-2">
                        <Video className="size-3.5 text-accent" /> Join Meet
                      </a>
                    )}
                    <Button size="sm" variant={past && !fb ? "primary" : "secondary"} onClick={() => onOpen(c.id, "interview")}>
                      {fb ? "View brief" : past ? "Log interview brief" : "Prep brief"}
                    </Button>
                  </div>
                );
              })}
            </Card>
          </section>
        ) : null,
      )}
    </div>
  );
}

function SkeletonTable() {
  return (
    <Card className="divide-y divide-line">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 h-16">
          <div className="size-9 rounded-full shimmer" />
          <div className="flex-1 space-y-2"><div className="h-3 w-48 rounded shimmer" /><div className="h-2.5 w-80 rounded shimmer" /></div>
          <div className="h-2 w-32 rounded shimmer" />
        </div>
      ))}
    </Card>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <Card className="py-20 px-6 text-center">
      <div className="size-12 mx-auto rounded-2xl bg-accent-soft text-accent grid place-items-center"><Inbox className="size-5" /></div>
      <h2 className="mt-5 text-[17px] font-semibold tracking-tight">Upload the first batch of CVs</h2>
      <p className="mt-2 text-[13.5px] text-muted max-w-md mx-auto leading-relaxed">
        Drop in PDFs or Word files for the PM or Senior PM role. Each one is read, stripped of personal details, scored against rubric v3 and ranked — with a brief and draft emails ready for your call.
      </p>
      <Button variant="primary" className="mt-6" onClick={onUpload}><FileUp className="size-4" /> Upload CVs</Button>
    </Card>
  );
}

function SetupNotice({ message }: { message: string }) {
  const db = /DATABASE_URL/.test(message);
  return (
    <div className="rounded-xl border border-warn/25 bg-warn-soft px-5 py-4 flex gap-3">
      <AlertTriangle className="size-5 text-warn shrink-0 mt-0.5" />
      <div className="text-[13px] text-ink-2">
        <div className="font-medium text-ink">{db ? "Connect the Neon database" : "Couldn't load candidates"}</div>
        <div className="mt-0.5">{db ? "Add DATABASE_URL (your Neon connection string) to the environment variables and redeploy." : message}</div>
      </div>
    </div>
  );
}
