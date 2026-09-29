// The INTERNAL SPEEDX lead-scoring engine. This file must be imported ONLY
// from app/api/lead/route.ts (a server-only route handler). No "use client"
// component may import this — that's what keeps the internal score and
// classification out of the client JS bundle and out of any network
// response the respondent's browser can see, not just out of the UI.
//
// Every mapping below is the exact value approved for this build — do not
// approximate or round differently; the internal score must stay fully
// deterministic and testable.

import { QUALIFICATION_QUESTIONS } from "./questions";
import { ROLE_OPTIONS } from "./types";
import type { QualificationAnswers, RoleId } from "./types";

function pointsFor(questionId: (typeof QUALIFICATION_QUESTIONS)[number]["id"], optionId: string | undefined): number {
  if (!optionId) return 0;
  const question = QUALIFICATION_QUESTIONS.find((q) => q.id === questionId);
  const option = question?.options.find((o) => o.id === optionId);
  return option?.points ?? 0;
}

function roleScore(roleId: RoleId | undefined): number {
  if (!roleId) return 0;
  return ROLE_OPTIONS.find((r) => r.id === roleId)?.points ?? 0;
}

export interface InternalScoreInput {
  qualification: QualificationAnswers;
  role: RoleId;
  agencyHealthScore: number; // the PUBLIC score, 0-100 — see lib/scoring.ts
}

export interface InternalScoreResult {
  score: number;
  classification: "Tier 1: High Priority" | "Tier 2: Qualified" | "Tier 3: Nurture" | "Tier 4: Low Fit";
}

function classify(score: number): InternalScoreResult["classification"] {
  if (score >= 75) return "Tier 1: High Priority";
  if (score >= 55) return "Tier 2: Qualified";
  if (score >= 35) return "Tier 3: Nurture";
  return "Tier 4: Low Fit";
}

/**
 * internal_lead_score = round(
 *   (company_revenue_score * 0.20) +
 *   (budget_score          * 0.30) +
 *   (role_score            * 0.20) +
 *   (renewal_score         * 0.15) +
 *   (agency_pain_score     * 0.15)
 * )
 *
 * budget_score = (marketing_spend_score * 0.40) + (agency_spend_score * 0.60)
 * agency_pain_score = 100 - agency_health_score
 */
export function computeInternalLeadScore(input: InternalScoreInput): InternalScoreResult {
  const companyRevenueScore = pointsFor("revenue", input.qualification.revenue);
  const marketingSpendScore = pointsFor("marketingSpend", input.qualification.marketingSpend);
  const agencySpendScore = pointsFor("agencySpend", input.qualification.agencySpend);
  const renewalScore = pointsFor("renewalTiming", input.qualification.renewalTiming);
  const budgetScore = marketingSpendScore * 0.4 + agencySpendScore * 0.6;
  const roleScoreValue = roleScore(input.role);
  const agencyPainScore = 100 - input.agencyHealthScore;

  const score = Math.round(
    companyRevenueScore * 0.2 + budgetScore * 0.3 + roleScoreValue * 0.2 + renewalScore * 0.15 + agencyPainScore * 0.15
  );

  return { score, classification: classify(score) };
}
