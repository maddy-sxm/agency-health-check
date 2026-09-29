// The PUBLIC Agency Health scoring engine. Pure functions only — no I/O, no
// randomness, no LLM calls — so results are instant, free, and identically
// reproducible in tests. Safe to import from "use client" components AND
// from app/api/lead/route.ts.
//
// This file must never import lib/internal-scoring.ts, and nothing in
// lib/internal-scoring.ts should import this one either, other than the
// single `agencyHealthScore` number it needs — see that file's comment for
// why the internal lead score must stay out of the client bundle.

import { DIAGNOSTIC_MAX_SCORE, DIAGNOSTIC_QUESTIONS } from "./questions";
import { PILLARS, pillarFor } from "./pillars";
import { SIGNAL_COPY } from "./signal-copy";
import { TIERS } from "./copy";
import type {
  DiagnosticAnswers,
  DiagnosticQuestionId,
  PillarRating,
  PillarResult,
  PublicResult,
  Signal,
  Synthesis,
  Tier,
} from "./types";

function scoreForAnswer(questionId: DiagnosticQuestionId, optionId: string | undefined): number {
  if (!optionId) return 0;
  const question = DIAGNOSTIC_QUESTIONS.find((q) => q.id === questionId);
  const option = question?.options.find((o) => o.id === optionId);
  return option?.points ?? 0;
}

/** Sum of the 8 diagnostic answers, 0-24. Missing answers score 0. */
export function rawDiagnosticScore(answers: DiagnosticAnswers): number {
  return DIAGNOSTIC_QUESTIONS.reduce((sum, q) => sum + scoreForAnswer(q.id, answers[q.id]), 0);
}

/** True, uncapped 0-100 score — round((raw_score / 24) * 100). Never shown
 *  to the respondent (see agencyHealthScore() below); this exists only so
 *  app/api/lead/route.ts can feed an accurate, undistorted signal into the
 *  internal lead score's agency-pain component. */
export function trueAgencyHealthScore(answers: DiagnosticAnswers): number {
  const raw = rawDiagnosticScore(answers);
  return Math.round((raw / DIAGNOSTIC_MAX_SCORE) * 100);
}

// Product decision: no respondent should ever be told their agency
// relationship is healthy, no matter how strong their answers are. Hard
// cap, not a rescale — everyone from a genuinely great agency (raw ~15/24
// and up) to a perfect 24/24 shows the same ceiling, which is intentional:
// this tool should never look like a "you're fine, no need for us" result.
const PUBLIC_SCORE_CEILING = 62;

/** Public-facing score shown to the respondent — capped at 62. Note this
 *  is NOT what determines the archetype/tier shown alongside it — see
 *  tierFor() and computePublicResult() below, which resolve the archetype
 *  from the true score instead. */
export function agencyHealthScore(answers: DiagnosticAnswers): number {
  return Math.min(trueAgencyHealthScore(answers), PUBLIC_SCORE_CEILING);
}

/** Resolves the archetype tier. Called with the TRUE 0-100 score (see
 *  computePublicResult), not the capped public score — the number shown to
 *  the respondent and the archetype describing it are deliberately
 *  independent. */
export function tierFor(score: number): (typeof TIERS)[number] {
  const match = TIERS.find((t) => score >= t.minScore && score <= t.maxScore);
  // TIERS spans 0-100 with no gaps, so this only happens on an out-of-range
  // input (e.g. NaN from an incomplete answer set upstream).
  return match ?? TIERS[TIERS.length - 1];
}

function ratingForRawPillarScore(raw: number): PillarRating {
  if (raw >= 6) return "Strong";
  if (raw >= 4) return "Developing";
  if (raw >= 2) return "At Risk";
  return "Critical";
}

export function computeSignals(answers: DiagnosticAnswers): Signal[] {
  return DIAGNOSTIC_QUESTIONS.map((q) => {
    const optionId = answers[q.id];
    const score = scoreForAnswer(q.id, optionId);
    const phrase = optionId ? SIGNAL_COPY[q.id][optionId] : SIGNAL_COPY[q.id][q.options[q.options.length - 1].id];
    return { questionId: q.id, pillar: q.pillar, score, phrase };
  });
}

export function computePillarResults(signals: Signal[]): PillarResult[] {
  return PILLARS.map((pillar) => {
    const raw = signals.filter((s) => pillar.questionIds.includes(s.questionId)).reduce((sum, s) => sum + s.score, 0);
    return { key: pillar.key, label: pillar.label, rawScore: raw, rating: ratingForRawPillarScore(raw) };
  });
}

interface StrengthsWeaknesses {
  strengths: Signal[];
  strengthsHeading: string | null;
  weaknesses: Signal[];
  weaknessesHeading: string | null;
}

/**
 * Deterministic strength/weakness selection.
 *  - Strength: only an answer scoring 2 or 3 qualifies. Top 2 by score.
 *  - Material weakness: an answer scoring 0 or 1. Worst 3 by score.
 *  - If there are zero material weaknesses, the section becomes "Areas
 *    Worth Watching", populated from score-2 answers NOT already used as a
 *    strength — genuine, never manufactured.
 *  - If there are fewer than 2 genuine strengths, the section is not
 *    padded; if there are zero, it's hidden entirely.
 */
export function computeStrengthsAndWeaknesses(signals: Signal[]): StrengthsWeaknesses {
  const weaknesses = signals
    .filter((s) => s.score <= 1)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  const strengths = signals
    .filter((s) => s.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const usedIds = new Set(strengths.map((s) => s.questionId));
  const watchItems = signals.filter((s) => s.score === 2 && !usedIds.has(s.questionId)).slice(0, 2);

  const weaknessesHeading = weaknesses.length > 0 ? "Where It Breaks Down" : watchItems.length > 0 ? "Areas Worth Watching" : null;

  return {
    strengths,
    strengthsHeading: strengths.length > 0 ? "Genuine Strengths" : null,
    weaknesses: weaknesses.length > 0 ? weaknesses : watchItems,
    weaknessesHeading,
  };
}

function pillarLabel(pillar: PillarResult): string {
  return pillar.label;
}

/**
 * "What This Means" and the recommendation, composed from approved
 * deterministic templates — never a live generation call. This is the
 * DEEPER, pillar-specific interpretation — distinct from the tier's own
 * `message` (already shown visibly above it on the results page as the
 * short diagnostic description), so it deliberately does not repeat that
 * sentence. Driven by: overall archetype, the lowest-scoring pillar, and
 * the second-lowest pillar (Black Box / Ghost Retainer only, and only if
 * it's also genuinely weak).
 */
export function composeSynthesis(tier: Tier, pillars: PillarResult[]): Synthesis {
  const ascending = [...pillars].sort((a, b) => a.rawScore - b.rawScore);
  const lowest = ascending[0];
  const secondLowest = ascending[1];
  const lowestMeta = PILLARS.find((p) => p.key === lowest.key)!;
  const secondLowestMeta = PILLARS.find((p) => p.key === secondLowest.key)!;

  let whatThisMeans: string;
  let recommendation: string;

  if (tier === "strong-foundation") {
    whatThisMeans = `Even here, ${pillarLabel(
      lowest
    )} shows the most room to grow relative to the rest of the relationship, worth a closer look as you plan next steps.`;
    recommendation = `Consider a periodic outside review to make sure you're capturing every bit of value from this partnership, starting with ${pillarLabel(
      lowest
    )}.`;
  } else if (tier === "coasting") {
    whatThisMeans = lowestMeta.weakClause;
    recommendation = `Before your next renewal, it's worth identifying exactly where complacency may be capping growth, particularly around ${pillarLabel(
      lowest
    )}.`;
  } else if (tier === "order-taker") {
    whatThisMeans = lowestMeta.weakClause;
    recommendation = `Consider whether your internal team is compensating for strategic leadership your agency should be providing, especially around ${pillarLabel(
      lowest
    )}.`;
  } else if (tier === "black-box") {
    const extra = secondLowest.rawScore <= 3 ? ` ${secondLowestMeta.weakClause}` : "";
    whatThisMeans = `${lowestMeta.weakClause}${extra}`;
    recommendation =
      secondLowest.rawScore <= 3
        ? `Given the visibility gaps here, particularly around ${pillarLabel(lowest)} and ${pillarLabel(
            secondLowest
          )}, it's worth getting a clear-eyed audit of what's actually happening in this account before your next budget cycle.`
        : `Given the visibility gaps here, particularly around ${pillarLabel(
            lowest
          )}, it's worth getting a clear-eyed audit of what's actually happening in this account before your next budget cycle.`;
  } else {
    // ghost-retainer
    const extra = secondLowest.rawScore <= 3 ? ` ${secondLowestMeta.weakClause}` : "";
    whatThisMeans = `${lowestMeta.weakClause}${extra}`;
    recommendation = "This relationship is worth reviewing before your next renewal or major budget decision, not after.";
  }

  return { whatThisMeans, recommendation };
}

/** Orchestrates the full public result. This is the one function the UI
 *  and the API route both call.
 *
 *  The archetype (tier/tierLabel/tierMessage) is resolved from the TRUE,
 *  uncapped score — see trueAgencyHealthScore() — while `score` itself
 *  stays the capped, public-facing number. These can legitimately diverge
 *  (e.g. a true 95 still displays as 62, but resolves to "Strong
 *  Foundation, More Headroom" rather than "The Order Taker") — that's the
 *  point: the number stays modest, the archetype stays honest. */
export function computePublicResult(answers: DiagnosticAnswers): PublicResult {
  const score = agencyHealthScore(answers);
  const trueScore = trueAgencyHealthScore(answers);
  const meta = tierFor(trueScore);
  const signals = computeSignals(answers);
  const pillars = computePillarResults(signals);
  const { strengths, strengthsHeading, weaknesses, weaknessesHeading } = computeStrengthsAndWeaknesses(signals);
  const synthesis = composeSynthesis(meta.tier, pillars);

  return {
    score,
    tier: meta.tier,
    tierLabel: meta.label,
    tierMessage: meta.message,
    pillars,
    strengths,
    strengthsHeading,
    weaknesses,
    weaknessesHeading,
    synthesis,
  };
}
