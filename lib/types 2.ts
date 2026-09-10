// Shared types for Agency Health Check.
//
// Two scores exist and must never mix in the client bundle:
//  - `agencyHealthScore` / tier / pillars — PUBLIC, shown to the respondent.
//    Computed by the pure functions in lib/scoring.ts, safe to import from
//    "use client" components.
//  - `internalLeadScore` / classification — INTERNAL ONLY. Computed by
//    lib/internal-scoring.ts, which is imported ONLY from app/api/lead/route.ts.
//    No "use client" file may import it — that's what keeps it out of the
//    client bundle entirely, not just out of the UI.

export type PillarKey = "communication" | "strategy" | "stability" | "accountability";

// 5 archetypes, matched against the TRUE (uncapped) score — see
// trueAgencyHealthScore() in lib/scoring.ts. The PUBLIC score shown to the
// respondent stays hard-capped at PUBLIC_SCORE_CEILING regardless of which
// archetype this resolves to, so a top-tier result never displays as
// "100" — it displays as the capped number with a title that still leaves
// room for improvement. "right-fit" is deliberately never a value here —
// the top archetype is "strong-foundation" instead, which explicitly
// frames the result as having more headroom rather than "nothing left to
// evaluate."
export type Tier = "strong-foundation" | "coasting" | "order-taker" | "black-box" | "ghost-retainer";

export interface QuestionOption {
  id: string;
  label: string;
  points: number;
}

export type DiagnosticQuestionId =
  | "contact"
  | "responsiveness"
  | "turnover"
  | "proactivity"
  | "strategyDoc"
  | "perfAccountability"
  | "renewal"
  | "dataOwnership";

export interface DiagnosticQuestion {
  id: DiagnosticQuestionId;
  pillar: PillarKey;
  eyebrow: string;
  headline: string;
  sub?: string;
  options: QuestionOption[];
}

export type DiagnosticAnswers = Partial<Record<DiagnosticQuestionId, string>>;

export type QualificationQuestionId = "revenue" | "marketingSpend" | "agencySpend" | "renewalTiming";

export interface QualificationQuestion {
  id: QualificationQuestionId;
  eyebrow: string;
  headline: string;
  sub?: string;
  options: QuestionOption[];
}

export type QualificationAnswers = Partial<Record<QualificationQuestionId, string>>;

export const ROLE_OPTIONS = [
  { id: "ceo-founder", label: "CEO / Founder / President", points: 100 },
  { id: "cmo", label: "CMO / Chief Growth Officer / Marketing Executive", points: 100 },
  { id: "vp", label: "VP / Head of Marketing or Growth", points: 85 },
  { id: "director", label: "Director of Marketing or Growth", points: 70 },
  { id: "manager", label: "Manager / Individual Contributor", points: 40 },
  { id: "other", label: "Other", points: 20 },
] as const;

export type RoleId = (typeof ROLE_OPTIONS)[number]["id"];

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  role: RoleId;
}

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  landingUrl?: string;
}

export interface Signal {
  questionId: DiagnosticQuestionId;
  pillar: PillarKey;
  score: number;
  phrase: string;
}

export type PillarRating = "Strong" | "Developing" | "At Risk" | "Critical";

export interface PillarResult {
  key: PillarKey;
  label: string;
  rawScore: number; // 0-6
  rating: PillarRating;
}

export interface Synthesis {
  whatThisMeans: string;
  recommendation: string;
}

/** Everything safe to compute client-side and show to the respondent. */
export interface PublicResult {
  score: number; // 0-100
  tier: Tier;
  tierLabel: string;
  tierMessage: string;
  pillars: PillarResult[];
  strengths: Signal[];
  strengthsHeading: string | null; // null = section hidden entirely
  weaknesses: Signal[];
  weaknessesHeading: string | null; // null = "no gaps" empty state
  synthesis: Synthesis;
}

/** Which of the two lead-form CTAs the respondent chose — see
 *  ReportPreviewScreen. Both always trigger the emailed full report (see
 *  lib/email.ts); "call" additionally heads straight to booking instead of
 *  showing the on-screen score reveal. Kept for sales context, not to gate
 *  the email — the two CTAs are additive, not mutually exclusive. */
export type LeadIntent = "report" | "call";

/** Full record persisted server-side. Includes the internal lead score,
 *  which is computed in app/api/lead/route.ts and never sent back to the
 *  client that submitted it. */
export interface LeadRecord {
  leadId: string;
  contact: ContactInfo;
  services: string[];
  diagnosticAnswers: DiagnosticAnswers;
  qualificationAnswers: QualificationAnswers;
  publicResult: PublicResult;
  internalLeadScore: number;
  internalClassification: string;
  intent: LeadIntent;
  utm: UtmParams;
  source: "agency-health-check";
  createdAt: string;
}
