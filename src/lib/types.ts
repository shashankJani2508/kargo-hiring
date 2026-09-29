import type { Decision, Evaluation, Path, Role } from "./rubric";

export type Stage = "new" | "invited" | "declined" | "interviewed" | "offer" | "closed";

export interface EmailLogEntry {
  kind: "invite" | "decline";
  to: string;
  subject: string;
  sent_at: string;
  resend_id: string | null;
  overridden: boolean;
  status: "sent" | "failed";
  error?: string;
}

export interface InterviewInfo {
  date: string;
  time: string;
  duration_minutes: number;
  meet_link: string;
  scheduled_at: string; // ISO start
}

export type Verdict = "strong" | "weak" | "skipped";
export type Outcome = "Advance" | "Offer" | "Hold" | "Decline";

export interface InterviewFeedback {
  interviewed_on: string;
  probes: { variable: string; question: string; verdict: Verdict; note: string }[];
  rating: number; // 1–5 overall
  outcome: Outcome;
  summary: string;
  adjusted_total: number;
  adjusted_decision: Decision;
  lowered: string[];
  saved_at: string;
}

export interface Candidate {
  id: string;
  created_at: string;
  role_applied: Role;
  file_name: string | null;
  status: "processing" | "ready" | "error";
  error: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  pm_eval: Evaluation | null;
  spm_eval: Evaluation | null;
  primary_role: Role | null;
  primary_note: string | null;
  decision: Decision | null;
  total: number | null;
  path: Path | null;
  brief: string | null;
  why_line: string | null;
  invite_draft: { subject: string; body: string } | null;
  decline_draft: { subject: string; body: string } | null;
  rubric_version: string | null;
  scored_at: string | null;
  stage: Stage;
  arjun_decision: string | null;
  arjun_reason: string | null;
  decided_at: string | null;
  interview: InterviewInfo | null;
  interview_feedback: InterviewFeedback | null;
  email_log: EmailLogEntry[];
}
