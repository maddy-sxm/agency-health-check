import type { DiagnosticQuestionId } from "./types";

/**
 * One short, neutral phrase per answer option, keyed by question id then
 * option id. lib/scoring.ts buckets these into strengths (score 2 or 3) or
 * weaknesses (score 0 or 1) purely by the score the respondent's answer
 * carries — the phrase itself doesn't editorialize, so the same table
 * serves both buckets and stays fully deterministic (no generation, no
 * runtime AI call).
 */
export const SIGNAL_COPY: Record<DiagnosticQuestionId, Record<string, string>> = {
  contact: {
    "same-person": "A stable, dedicated account contact",
    rotates: "Your point of contact rotates by project, with no consistent owner",
    none: "No consistent point of contact on the account",
  },
  responsiveness: {
    "same-day": "Fast, same-day response times from your account team",
    "one-two-days": "Reasonably responsive account team (1 to 2 days)",
    "three-five-days": "Slow turnaround on requests (3 to 5 days)",
    "week-plus": "Requests routinely take a week or more to get a response",
  },
  turnover: {
    never: "Zero account team turnover since you started working together",
    once: "One account team change since you started working together",
    "more-than-once": "Multiple account team changes, creating repeated ramp-up",
    constantly: "Constant account team turnover",
  },
  proactivity: {
    "they-lead": "Your agency proactively leads with new ideas",
    "fifty-fifty": "New ideas come roughly evenly from both sides",
    "we-lead-most": "Your team initiates most new ideas, not your agency",
    "we-lead-all": "Your team originates all new ideas, your agency doesn't",
  },
  strategyDoc: {
    "clear-documented": "Work is tied to a clear, documented strategy",
    "some-inconsistent": "A strategy exists but is applied inconsistently",
    "mostly-ad-hoc": "Work feels mostly ad hoc, with little strategic grounding",
    "no-strategy": "No visible strategy behind the work",
  },
  perfAccountability: {
    definitely: "Your agency proactively flags performance problems before you have to ask",
    probably: "Your agency would likely flag a performance dip on its own",
    "probably-not": "Performance problems likely wouldn't surface until your team asked",
    "definitely-not": "Performance problems would go unflagged until your team caught them",
  },
  renewal: {
    confident: "You feel confident heading into renewal conversations",
    neutral: "You feel neutral, neither confident nor anxious, about renewal",
    anxious: "Renewal conversations make you anxious",
    dreading: "You dread renewal conversations with this agency",
  },
  dataOwnership: {
    "yes-fully": "You could cleanly take your data, assets, and learnings if you left",
    mostly: "You could take most of your data and assets if you left",
    "not-really": "You couldn't cleanly extract your data and assets if you left",
    "no-idea": "You wouldn't even know what to ask for if you left",
  },
};
