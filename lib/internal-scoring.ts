// The INTERNAL SPEEDX lead-scoring engine. This file must be imported ONLY
// from app/api/lead/route.ts (a server-only route handler). No "use client"
// component may import this — that's what keeps the internal score and
// classification out of the client JS bundle and out of any network
// response the respondent's browser can see, not just out of the UI.
//
// The per-option point values (lib/questions.ts, lib/types.ts ROLE_OPTIONS)
// and the component weights below are the approved values — do not change
// them casually. The score is fully deterministic and covered by
// tests/internal-scoring.test.ts.
//
// NORMALISATION. The score is a weighted average over the components that
// were actually collected. When every input is present this is exactly the
// original approved formula (the weights sum to 1). When an input was never
// asked — the 4 qualification questions were removed from the flow on
// 2026-09-29 — that component is left out and the remaining weights are
// scaled up proportionally, instead of silently scoring the missing data as
// zero. Without this, role + agency pain alone could reach at most 35/100
// and every lead classified as "Tier 4: Low Fit".

import { QUALIFICATION_QUESTIONS } from "./questions";
import { ROLE_OPTIONS } from "./types";
import type { QualificationAnswers, QualificationQuestionId, RoleId } from "./types";

/** Approved component weights. Sum to 1. */
const WEIGHTS = {
  revenue: 0.2,
  budget: 0.3,
  role: 0.2,
  renewal: 0.15,
  agencyPain: 0.15,
} as const;

/** Inside the budget component. Sum to 1. */
const BUDGET_WEIGHTS = { marketingSpend: 0.4, agencySpend: 0.6 } as const;

export type ScoreComponent = keyof typeof WEIGHTS;

/** Points for an answer, or null when the question was not answered (or the
 *  option id isn't a real one) — null means "no data", which is different
 *  from an answered option that is worth 0 points. */
function pointsFor(questionId: QualificationQuestionId, optionId: string | undefined): number | null {
  if (!optionId) return null;
  const question = QUALIFICATION_QUESTIONS.find((q) => q.id === questionId);
  const option = question?.options.find((o) => o.id === optionId);
  return option ? option.points : null;
}

function roleScore(roleId: RoleId | undefined): number | null {
  if (!roleId) return null;
  const role = ROLE_OPTIONS.find((r) => r.id === roleId);
  return role ? role.points : null;
}

/** Weighted average of the parts that have data; null if none do. */
function weightedAverage(parts: Array<{ value: number | null; weight: number }>): number | null {
  const present = parts.filter((p): p is { value: number; weight: number } => p.value !== null);
  const totalWeight = present.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight === 0) return null;
  return present.reduce((sum, p) => sum + p.value * p.weight, 0) / totalWeight;
}

export interface InternalScoreInput {
  qualification: QualificationAnswers;
  role: RoleId;
  /** The TRUE, uncapped 0-100 agency health score — see lib/scoring.ts. */
  agencyHealthScore: number;
}

export interface InternalScoreResult {
  score: number;
  classification: "Tier 1: High Priority" | "Tier 2: Qualified" | "Tier 3: Nurture" | "Tier 4: Low Fit";
  /** Which components the score was computed from, in weight-table order.
   *  Stored on the lead so a score can always be read in context. */
  basis: ScoreComponent[];
}

function classify(score: number): InternalScoreResult["classification"] {
  if (score >= 75) return "Tier 1: High Priority";
  if (score >= 55) return "Tier 2: Qualified";
  if (score >= 35) return "Tier 3: Nurture";
  return "Tier 4: Low Fit";
}

/**
 * internal_lead_score = round( weighted average over the components with data )
 *
 *   component            weight   source
 *   company_revenue       0.20    qualification.revenue
 *   budget                0.30    marketing_spend * 0.40 + agency_spend * 0.60
 *   role                  0.20    contact.role
 *   renewal               0.15    qualification.renewalTiming
 *   agency_pain           0.15    100 - agency_health_score
 */
export function computeInternalLeadScore(input: InternalScoreInput): InternalScoreResult {
  const budget = weightedAverage([
    { value: pointsFor("marketingSpend", input.qualification.marketingSpend), weight: BUDGET_WEIGHTS.marketingSpend },
    { value: pointsFor("agencySpend", input.qualification.agencySpend), weight: BUDGET_WEIGHTS.agencySpend },
  ]);

  const components: Record<ScoreComponent, number | null> = {
    revenue: pointsFor("revenue", input.qualification.revenue),
    budget,
    role: roleScore(input.role),
    renewal: pointsFor("renewalTiming", input.qualification.renewalTiming),
    agencyPain: 100 - input.agencyHealthScore,
  };

  const keys = Object.keys(WEIGHTS) as ScoreComponent[];
  const average = weightedAverage(keys.map((key) => ({ value: components[key], weight: WEIGHTS[key] })));
  const score = Math.min(100, Math.max(0, Math.round(average ?? 0)));

  return {
    score,
    classification: classify(score),
    basis: keys.filter((key) => components[key] !== null),
  };
}
