import type { Tier } from "./types";

/**
 * Every user-facing string lives here or in lib/questions.ts /
 * lib/pillars.ts / lib/signal-copy.ts. Renaming the tool, rewording a
 * screen, or tightening a disclaimer should only ever touch these files.
 *
 * Tone: intelligent, diagnostic, confident, executive-level. Not gimmicky,
 * not aggressively anti-agency. Willing to tell a respondent their agency
 * relationship is healthy — the credibility of the tool depends on it.
 */

export const COPY = {
  brand: {
    name: "SPEEDXMEDIA",
    toolName: "Agency Health Check",
  },

  hero: {
    eyebrow: "AGENCY HEALTH CHECK",
    headline: "How Healthy Is Your Marketing Agency Relationship?",
    sub: "See how your current agency performs across communication, strategic leadership, accountability, transparency, and long-term partnership health.",
    servicesLabel: "What services does your current agency provide?",
    servicesSub: "Select all that apply.",
    startCta: "Start My Diagnostic",
  },

  analyzing: {
    // Screen 10 — after the 8 diagnostic questions, before the
    // qualification screens. Pure pacing, not gating on any network call.
    diagnostic: {
      messages: [
        "Scoring your responses.",
        "Mapping signals across communication, strategy, stability, and accountability.",
        "Cross-referencing against SPEEDXMEDIA partnership benchmarks.",
      ],
    },
    // Screen 16 — after lead capture, before the full results reveal.
    report: {
      messages: ["Finalizing your Agency Health Score.", "Building your personalized diagnostic report."],
    },
  },

  qualification: {
    intro: "A few details to benchmark your results",
  },

  leadGate: {
    // No eyebrow/score-pill/pillar-pill teaser here anymore — the score
    // circle and real (partly blurred) pillars already render above this
    // form on the same page (see ReportPreviewScreen), so a second, lower-
    // fidelity teaser would be redundant. This headline is just the
    // transition into the contact form.
    headline: "Your Full Agency Health Report Is Ready.",
    fields: {
      name: "Full name",
      email: "Work email",
      phone: "Work phone",
      role: "Role",
      rolePlaceholder: "Select your role",
    },
    // Primary path (red, shown first): skips the on-screen score reveal and
    // heads straight to booking. Needs both "team" and "report" in the
    // label (that's the whole point of this CTA), but short — two earlier
    // versions missed one side of that balance: "Set Up a Strategy Call to
    // Review Your Report With Our Team" was clunky/long, and plain "Set Up
    // a Strategy Call" dropped the report/team connection entirely. The
    // reassurance that the report still gets emailed regardless lives in
    // bookCallSub below the button.
    bookCallCta: "Speak With Our Team About Your Report",
    bookCallSub: "You'll still get your full Agency Health Report emailed too.",
    orDivider: "or",
    // Secondary path (outline, shown second) — NOT an alternative to the
    // call. Both buttons always email the report (see
    // app/api/lead/route.ts); this one just shows the on-screen score
    // reveal instead of heading straight to booking. Both buttons submit
    // the same captured lead — see AgencyHealthCheckExperience's
    // handleSubmitForReport / handleSubmitForCall.
    cta: "Get Your Full Agency Health Report Emailed",
    privacyNote: "Used to deliver your report. SPEEDXMEDIA may send relevant strategic follow-up.",
  },

  results: {
    preparedFor: "Prepared for",
    // Shown as a small caption BELOW the score circle (not above it).
    scoreLabel: "Agency Health Score",
    pillarsHeading: "Diagnostic Pillars",
    whatThisMeansHeading: "What This Means",
    recommendationHeading: "Recommended Next Step",
    noGapsMessage: "No material gaps identified in this assessment.",
    // Overlay label on every blurred report-preview block (locked pillars,
    // the rest of the strengths/weaknesses lists, What This Means,
    // Recommended Next Step) — the real computed content sits underneath
    // the blur, never a placeholder, so this just names what's hidden.
    lockedLabel: "Full Result In Your Report",
    // Post-submission confirmation (ReportSentScreen) — only reached via
    // the "report" path; "call" redirects straight to CTA_HREF instead.
    // {email} is replaced with the submitted work email.
    reportSentHeading: "Your Full Report Is On Its Way",
    reportSentBody: "We've emailed your full Agency Health Report to {email}.",
    startOver: "Retake the Assessment",
  },

  footer: {
    name: "SPEEDXMEDIA",
    // TODO: confirm real company contact details before launch.
    email: "hello@speedxmedia.com",
    emailHref: "mailto:hello@speedxmedia.com",
    disclaimer:
      "Your Agency Health Score is a self-assessment based on your responses to this diagnostic. It is intended to surface directional signal about your agency relationship, not to serve as a formal audit.",
  },

  errors: {
    generic: "Something went wrong. Please try again.",
    requiredField: "Please complete this field.",
    invalidEmail: "Please enter a valid work email address.",
    invalidPhone: "Please enter a valid phone number.",
  },
} as const;

export interface TierMeta {
  tier: Tier;
  label: string;
  minScore: number;
  maxScore: number;
  message: string;
}

// Result tiers — order matters, tierFor() in lib/scoring.ts walks this
// list and returns the first match. Bands are matched against the TRUE,
// uncapped 0-100 score (trueAgencyHealthScore in lib/scoring.ts), not the
// publicly displayed number — the display stays hard-capped at
// PUBLIC_SCORE_CEILING regardless of which archetype this resolves to, so
// a "strong-foundation" result can still show e.g. "62 / 100" next to it.
// That's intentional: the number never claims the relationship is maxed
// out, even when the archetype honestly reflects a strong one.
//
// "The Right Fit" is never used as a label — "strong-foundation" uses
// "Strong Foundation, More Headroom" instead, which stays honest about a
// good result without implying there's no reason to look further.
//
// Note: whether the strengths/weaknesses section headings read as "Areas
// Worth Watching" vs. "Where It Breaks Down" is NOT driven by tier — it's
// derived purely from whether any individual answer actually scored 0 or 1
// (see lib/scoring.ts).
export const TIERS: TierMeta[] = [
  {
    tier: "strong-foundation",
    label: "Strong Foundation, More Headroom",
    minScore: 90,
    maxScore: 100,
    message:
      "Your agency relationship has strong fundamentals, but there are still opportunities to create greater strategic value, visibility, and performance.",
  },
  {
    tier: "coasting",
    label: "Comfortable, But Coasting",
    minScore: 70,
    maxScore: 89,
    message:
      "The fundamentals are there, but the relationship may be maintaining the account rather than actively pushing the business forward.",
  },
  {
    tier: "order-taker",
    label: "The Order Taker",
    minScore: 50,
    maxScore: 69,
    message:
      "Your agency is getting work done, but too much of the strategic direction may still be coming from your internal team.",
  },
  {
    tier: "black-box",
    label: "The Black Box",
    minScore: 30,
    maxScore: 49,
    message:
      "There are meaningful gaps in communication, accountability, visibility, or strategic leadership that are limiting the relationship.",
  },
  {
    tier: "ghost-retainer",
    label: "The Ghost Retainer",
    minScore: 0,
    maxScore: 29,
    message: "The relationship appears to be operating more like an ongoing retainer than an active strategic partnership.",
  },
];

// TODO: point at the real booking/contact destination once confirmed.
export const CTA_HREF = "mailto:hello@speedxmedia.com?subject=Agency%20Health%20Check%20-%20Second%20Opinion";
