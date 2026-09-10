import type { DiagnosticQuestion, QualificationQuestion, QuestionOption } from "./types";

/** Q1 — hero screen, non-scored, multi-select. Used for personalization
 *  only, never touches the Agency Health Score. */
export const SERVICE_OPTIONS: QuestionOption[] = [
  { id: "paid-media", label: "Paid Media", points: 0 },
  { id: "seo", label: "SEO", points: 0 },
  { id: "content-copy", label: "Content & Copy", points: 0 },
  { id: "creative-design", label: "Creative & Design", points: 0 },
  { id: "video-production", label: "Video Production", points: 0 },
  { id: "web-development", label: "Web Development", points: 0 },
  { id: "social-media", label: "Social Media Management", points: 0 },
  { id: "brand-strategy", label: "Brand Strategy", points: 0 },
  { id: "podcasting", label: "Podcasting", points: 0 },
  { id: "analytics-reporting", label: "Analytics & Reporting", points: 0 },
];

/** The 8 scored diagnostic questions. Order is fixed — it drives both the
 *  on-screen "Question X of 8" progress and the fixed question order shown
 *  to every respondent. Max points per question is always 3, so total max
 *  is always 24 regardless of how many options a given question has. */
export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  {
    id: "contact",
    pillar: "communication",
    eyebrow: "Question 1 of 8",
    headline: "Do you have a dedicated point of contact, or does it vary by project?",
    options: [
      { id: "same-person", label: "Same person, long term", points: 3 },
      { id: "rotates", label: "Rotates by project", points: 1 },
      { id: "none", label: "No consistent contact", points: 0 },
    ],
  },
  {
    id: "responsiveness",
    pillar: "communication",
    eyebrow: "Question 2 of 8",
    headline: "How long does it typically take to hear back from your account team on a request?",
    options: [
      { id: "same-day", label: "Same day", points: 3 },
      { id: "one-two-days", label: "1 to 2 days", points: 2 },
      { id: "three-five-days", label: "3 to 5 days", points: 1 },
      { id: "week-plus", label: "A week or more", points: 0 },
    ],
  },
  {
    id: "turnover",
    pillar: "stability",
    eyebrow: "Question 3 of 8",
    headline: "How often has your account team turned over since you started working together?",
    options: [
      { id: "never", label: "Never", points: 3 },
      { id: "once", label: "Once", points: 2 },
      { id: "more-than-once", label: "More than once", points: 1 },
      { id: "constantly", label: "Constantly", points: 0 },
    ],
  },
  {
    id: "proactivity",
    pillar: "strategy",
    eyebrow: "Question 4 of 8",
    headline: "Does your agency bring you new ideas, or do you mostly have to initiate requests?",
    options: [
      { id: "they-lead", label: "They lead", points: 3 },
      { id: "fifty-fifty", label: "Roughly 50/50", points: 2 },
      { id: "we-lead-most", label: "We lead most of the time", points: 1 },
      { id: "we-lead-all", label: "We do all the initiating", points: 0 },
    ],
  },
  {
    id: "strategyDoc",
    pillar: "strategy",
    eyebrow: "Question 5 of 8",
    headline: "Do they tie their work back to a documented strategy, or does it feel ad hoc?",
    options: [
      { id: "clear-documented", label: "Clear, documented strategy", points: 3 },
      { id: "some-inconsistent", label: "Some strategy, inconsistently applied", points: 2 },
      { id: "mostly-ad-hoc", label: "Mostly ad hoc", points: 1 },
      { id: "no-strategy", label: "No visible strategy", points: 0 },
    ],
  },
  {
    id: "perfAccountability",
    pillar: "accountability",
    eyebrow: "Question 6 of 8",
    headline:
      "If performance dropped for two months straight, would your agency flag it and explain what was happening before your team had to ask?",
    options: [
      { id: "definitely", label: "Definitely", points: 3 },
      { id: "probably", label: "Probably", points: 2 },
      { id: "probably-not", label: "Probably not", points: 1 },
      { id: "definitely-not", label: "Definitely not", points: 0 },
    ],
  },
  {
    id: "renewal",
    pillar: "accountability",
    eyebrow: "Question 7 of 8",
    headline: "How do you feel in the days before a renewal conversation?",
    options: [
      { id: "confident", label: "Confident", points: 3 },
      { id: "neutral", label: "Neutral", points: 2 },
      { id: "anxious", label: "Anxious", points: 1 },
      { id: "dreading", label: "Dreading it", points: 0 },
    ],
  },
  {
    id: "dataOwnership",
    pillar: "stability",
    eyebrow: "Question 8 of 8",
    headline: "If you left tomorrow, could you cleanly take your data, assets, and learnings with you?",
    options: [
      { id: "yes-fully", label: "Yes, fully", points: 3 },
      { id: "mostly", label: "Mostly", points: 2 },
      { id: "not-really", label: "Not really", points: 1 },
      { id: "no-idea", label: "No idea what we'd even ask for", points: 0 },
    ],
  },
];

export const DIAGNOSTIC_MAX_SCORE = DIAGNOSTIC_QUESTIONS.reduce(
  (max, q) => max + Math.max(...q.options.map((o) => o.points)),
  0
);

/** Qualification questions — firmographic, asked after the diagnostic and
 *  before the lead-capture gate. Never contribute to the Agency Health
 *  Score; they feed the internal lead score only (lib/internal-scoring.ts). */
export const QUALIFICATION_QUESTIONS: QualificationQuestion[] = [
  {
    id: "revenue",
    eyebrow: "Benchmark 1 of 4",
    headline: "What's your company's estimated annual revenue?",
    sub: "This helps us benchmark your results against similar companies.",
    options: [
      { id: "under-2m", label: "Under $2M", points: 0 },
      { id: "2m-5m", label: "$2M to $5M", points: 15 },
      { id: "5m-10m", label: "$5M to $10M", points: 35 },
      { id: "10m-25m", label: "$10M to $25M", points: 55 },
      { id: "25m-50m", label: "$25M to $50M", points: 75 },
      { id: "50m-100m", label: "$50M to $100M", points: 90 },
      { id: "100m-plus", label: "$100M+", points: 100 },
    ],
  },
  {
    id: "marketingSpend",
    eyebrow: "Benchmark 2 of 4",
    headline: "How much does your company invest in marketing each month?",
    options: [
      { id: "under-10k", label: "Under $10K", points: 0 },
      { id: "10k-25k", label: "$10K to $25K", points: 25 },
      { id: "25k-50k", label: "$25K to $50K", points: 50 },
      { id: "50k-100k", label: "$50K to $100K", points: 70 },
      { id: "100k-250k", label: "$100K to $250K", points: 90 },
      { id: "250k-plus", label: "$250K+", points: 100 },
    ],
  },
  {
    id: "agencySpend",
    eyebrow: "Benchmark 3 of 4",
    headline: "What does your company currently spend with external agencies each month?",
    options: [
      { id: "under-5k", label: "Under $5K", points: 0 },
      { id: "5k-10k", label: "$5K to $10K", points: 20 },
      { id: "10k-25k", label: "$10K to $25K", points: 50 },
      { id: "25k-50k", label: "$25K to $50K", points: 75 },
      { id: "50k-100k", label: "$50K to $100K", points: 90 },
      { id: "100k-plus", label: "$100K+", points: 100 },
      { id: "not-sure", label: "Not sure", points: 30 },
    ],
  },
  {
    id: "renewalTiming",
    eyebrow: "Benchmark 4 of 4",
    headline: "When is your current agency relationship next up for renewal or review?",
    options: [
      { id: "within-30-days", label: "Within 30 days", points: 100 },
      { id: "one-three-months", label: "1 to 3 months", points: 90 },
      { id: "three-six-months", label: "3 to 6 months", points: 70 },
      { id: "six-twelve-months", label: "6 to 12 months", points: 50 },
      { id: "more-than-12-months", label: "More than 12 months", points: 20 },
      { id: "ongoing-no-contract", label: "No formal contract / ongoing", points: 70 },
      { id: "not-sure", label: "Not sure", points: 30 },
    ],
  },
];
