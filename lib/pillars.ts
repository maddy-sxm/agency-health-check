import type { DiagnosticQuestionId, PillarKey, PillarRating } from "./types";

export interface PillarMeta {
  key: PillarKey;
  label: string;
  questionIds: [DiagnosticQuestionId, DiagnosticQuestionId];
  /** Always-visible one-liner shown on the results-page pillar card,
   *  including on the 3 locked cards (only the score/rating/bars/
   *  interpretation are blurred, never this). */
  description: string;
  /** Used in "What This Means" when this pillar is the weak point. */
  weakClause: string;
}

// Exactly the 4 pillars and pairings approved: each pillar is exactly 2
// questions, raw pillar score range is always 0-6.
export const PILLARS: PillarMeta[] = [
  {
    key: "communication",
    label: "Communication & Access",
    questionIds: ["contact", "responsiveness"],
    description: "Responsiveness, account access, and consistency of communication with your agency team.",
    weakClause:
      "Communication and access are a clear friction point, inconsistent contact and slow response times put more coordination burden on your team than it should.",
  },
  {
    key: "strategy",
    label: "Strategy & Proactivity",
    questionIds: ["proactivity", "strategyDoc"],
    description:
      "How consistently your agency brings strategic direction, new ideas, and proactive recommendations to the relationship.",
    weakClause:
      "Strategic leadership is the clearest gap here, your team is initiating more of the direction than your agency is.",
  },
  {
    key: "stability",
    label: "Stability & Continuity",
    questionIds: ["turnover", "dataOwnership"],
    description:
      "The consistency of your account team and your ability to retain your data, assets, and institutional knowledge.",
    weakClause:
      "Account stability and data portability are a real concern, turnover and unclear ownership create switching risk.",
  },
  {
    key: "accountability",
    label: "Accountability & Confidence",
    questionIds: ["perfAccountability", "renewal"],
    description:
      "How proactively your agency identifies performance issues and how confident you feel in the relationship overall.",
    weakClause:
      "Accountability is a clear gap, performance issues aren't being proactively surfaced, and renewal carries more anxiety than confidence.",
  },
];

export function pillarFor(questionId: DiagnosticQuestionId): PillarMeta {
  const pillar = PILLARS.find((p) => p.questionIds.includes(questionId));
  if (!pillar) throw new Error(`No pillar configured for question "${questionId}"`);
  return pillar;
}

/** One deterministic, pillar-agnostic sentence per rating — the "short
 *  interpretation of what the score means" shown on every pillar card
 *  (visible on Communication & Access, blurred-but-real on the other 3). */
export const PILLAR_RATING_INTERPRETATION: Record<PillarRating, string> = {
  Strong: "This is a clear strength in the relationship.",
  Developing: "This is functioning, but not yet where it could be.",
  "At Risk": "This is putting real strain on the relationship.",
  Critical: "This is one of the most urgent gaps in the relationship.",
};
