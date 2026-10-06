# SPEEDXMEDIA — Agency Health Check

Next.js 14 (App Router) + TypeScript + Tailwind. Same stack and Redis lead-storage pattern as the sibling tools (`payment-match-tool`, `drive-match-tool`, `lease-match-tool`, `exotic-match-tool`, `monthly-lineup-tool`), and the same dark/coral visual system as the Revenue Activation Plan tool (`revenue-activation-plan.speedxmedia.com`) — this is SPEEDX's own second assessment in that ecosystem, not a client tool.

## What this is

A lead-qualification diagnostic aimed at mid-market and larger companies that already work with a marketing agency, not a small-business quiz. The respondent gets an **Agency Health Score** (public, hard-capped at 62 — see below) and, if they choose, a personalized full report by email. SPEEDX separately gets an **internal lead score** (never shown to the respondent) that weighs company size, budget, buying authority, renewal timing, and agency pain — a bad Agency Health Score does not by itself make someone a good SPEEDX lead, and vice versa.

**No respondent ever sees a score above 62, and "The Right Fit" / "Comfortable, But Coasting" archetypes don't exist in this build.** This is a deliberate product decision, not a bug: nobody should walk away from this tool feeling their agency relationship needs no outside look. See "Scoring reference" below.

## Local dev

```bash
npm install
npm run dev
```

Opens at http://localhost:3107 (next available port after the sibling tools' 3101–3106). Runs without any env vars set — see "Local dev without Redis" below — but needs `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Redis) and `ADMIN_TOKEN` (admin export gate) for leads to actually persist.

### Local dev without Redis

Unlike the sibling tools, `lib/leads.ts` here does **not** throw if `KV_REST_API_URL` / `KV_REST_API_TOKEN` are unset — it logs a warning and no-ops instead, so the full assessment flow can be built and QA'd end to end before real Upstash credentials exist. **This must be fixed before production launch** — set real credentials (see below) so leads actually persist.

## The three scores — why they're structurally separate

- **Public — Agency Health Score.** Pure function of the 8 diagnostic answers, computed in `lib/scoring.ts`, hard-capped at 62 (`agencyHealthScore()`). Safe to import from client components; computed instantly client-side for UI responsiveness, then **recomputed server-side** in `app/api/lead/route.ts` from the raw answers before being persisted (never trusts a client-computed score). Only this capped number and its tier ever reach the results screen — the full pillar/strengths/weaknesses/synthesis breakdown is emailed, not displayed (see "Flow" below).
- **True Agency Health Score.** The same formula, uncapped 0-100 (`trueAgencyHealthScore()`). Never shown anywhere in the UI or API response — it exists solely to feed the internal lead score's agency-pain component with an undistorted signal, so a genuinely healthy agency doesn't get flattened to the same "pain" reading as a mediocre one just because the public score can't go above 62.
- **Internal — SPEEDX Lead Score.** Computed in `lib/internal-scoring.ts`, a module imported **only** by `app/api/lead/route.ts`. No `"use client"` file imports it, anywhere — that's what keeps it out of the client JS bundle and out of any network response the respondent's browser can see, not just out of the UI. `POST /api/lead` returns `{ leadId, result }` where `result` is the public result only.

All three, every raw answer, contact info, services, and UTM attribution are persisted together on the `LeadRecord` (`lib/types.ts`) — the internal score and the true uncapped score are withheld from the *response*, not from storage.

## Scoring reference (for QA)

All of this is deterministic — no LLM call, no randomness — so it's fully testable against fixed inputs.

**Agency Health Score** (`lib/scoring.ts`):
```
raw_score = sum of the 8 diagnostic answers' points (each question maxes at 3)
true_agency_health_score = round((raw_score / 24) * 100)      // internal use only, never shown
agency_health_score = min(true_agency_health_score, 62)       // PUBLIC_SCORE_CEILING — what the respondent sees
```
The cap is a hard ceiling, not a rescale: any raw score from ~15/24 up through a perfect 24/24 all show 62. That's intentional — the point is that nobody should ever look "done," not to preserve fine-grained differentiation at the top end.

Tiers (public, 0–62 only): 50–62 The Order Taker · 30–49 The Black Box · 0–29 The Ghost Retainer. **"The Right Fit" (originally 90–100) and "Comfortable, But Coasting" (originally 70–89) have been removed from the codebase entirely** — not just made unreachable by the cap — per explicit product decision. `Tier` in `lib/types.ts` no longer includes them, so reintroducing either requires a deliberate type change, not just tweaking a threshold.

**Pillars** (`lib/pillars.ts`) — exactly 2 questions each, raw range 0–6:
- Communication & Access: `contact` + `responsiveness`
- Strategy & Proactivity: `proactivity` + `strategyDoc`
- Stability & Continuity: `turnover` + `dataOwnership`
- Accountability & Confidence: `perfAccountability` + `renewal`

Rating thresholds: 6 = Strong · 4–5 = Developing · 2–3 = At Risk · 0–1 = Critical.

**Strengths / weaknesses** (`lib/scoring.ts` → `computeStrengthsAndWeaknesses`): an answer scoring 2 or 3 can be a strength (top 2 shown); an answer scoring 0 or 1 is a material weakness (worst 3 shown). If there are zero material weaknesses, the section becomes "Areas Worth Watching," populated from score-2 answers not already used as a strength. Sections are hidden rather than padded when there's nothing genuine to show. This breakdown is computed the same as ever — it's just delivered by email now instead of rendered inline (see "Flow" below).

**"What This Means" / recommendation** (`lib/scoring.ts` → `composeSynthesis`): template composition keyed by archetype tier plus the lowest (and, for Black Box / Ghost Retainer, second-lowest) pillar. No live generation call.

**Internal SPEEDX Lead Score** (`lib/internal-scoring.ts`) — a weighted average over the components that have data:

| Component | Weight | Source |
|---|---|---|
| Company revenue | 0.20 | qualification `revenue` |
| Budget | 0.30 | marketing spend × 0.40 + agency spend × 0.60 |
| Role | 0.20 | lead form role |
| Renewal timing | 0.15 | qualification `renewalTiming` |
| Agency pain | 0.15 | 100 − true agency health score |

With every component present this is the original formula. A component with no data is dropped and the rest are scaled up proportionally; an answered option worth 0 points still counts as data. Classification: 75–100 Tier 1 High Priority · 55–74 Tier 2 Qualified · 35–54 Tier 3 Nurture · 0–34 Tier 4 Low Fit. Per-option points live in `lib/questions.ts` and `lib/types.ts` (`ROLE_OPTIONS`). Covered by `tests/internal-scoring.test.ts` (`npm test`).

## Flow (13 screens)

1. Hero + Q1 services (non-scored, multi-select, personalization only)
2–9. The 8 scored diagnostic questions, one per screen
10. "Analyzing" transition (pacing only — scoring is instant and local, this never blocks on a network call)
11. Score preview + lead capture (name, work email, work phone, role) — **two CTAs, additive, not alternatives**: "Speak With Our Team About Your Report" (primary) and, below an "or" divider, "Get Your Full Agency Health Report Emailed" (secondary). Both submit the same lead; "call" additionally skips the on-screen confirmation and heads straight to the booking destination — see `handleSubmitForReport` vs. `handleSubmitForCall` in `AgencyHealthCheckExperience`.
12. "Generating your report" transition (report path only) — this is what actually awaits the `/api/lead` call. The "call" path skips this screen and navigates straight to `CTA_HREF`.
13. Confirmation — "your full report is on its way", naming the submitted email.

**Removed (2026-09-29): the 4 qualification/benchmark questions** (revenue, marketing spend, agency spend, renewal timing) that used to sit between steps 10 and 11. Their definitions (`QUALIFICATION_QUESTIONS` in `lib/questions.ts`) and the scoring that reads them are still in the codebase; the client now always sends `qualificationAnswers: {}`.

**Internal lead score after the removal:** those answers carried 65% of the score's weight. Rather than score missing data as zero (which capped every lead at 35, "Tier 4: Low Fit"), the score is now a weighted average over the components actually collected — today role and agency pain, at their approved 20:15 ratio. Each lead stores `internalScoreBasis` (visible in the sheet's Raw Payload JSON) so a score can be read in context. If the questions return, the original formula applies again automatically. The sheet's `Monthly Marketing Budget` column is blank while they're removed.

## Lead data isolation

Shares the same Upstash Redis instance as the sibling tools, isolated by key prefix — `agency-health-check:` here. **Confirm zero existing keys under that prefix** before first real use, same discipline as every tool in this suite (see `lib/leads.ts`). Read leads back via `GET /api/leads?token=<ADMIN_TOKEN>`.

## Google Sheets lead sync

Every completed submission is POSTed to the SPEEDX lead sheet ("Agency Tool Leads" tab) by `forwardLeadToSheet()` in `lib/sheets-webhook.ts`, called from `saveLead()` in `lib/leads.ts`. It fires **whether or not Redis is configured**, so the sheet always receives the lead. The payload keys match the sheet's "Webhook Setup" tab; the receiving Google Apps Script lives in `scripts/google-sheets-webhook.gs`.

Setup:
1. At script.google.com (any account with edit access to the sheet): New project → paste `scripts/google-sheets-webhook.gs` → Deploy → New deployment → Web app, execute as **Me**, access **Anyone** → copy the Web app URL.
2. Set `LEAD_WEBHOOK_URL` to that URL in the hosting project's env vars (Production) and redeploy.
3. Verify: `GET` the URL in a browser returns `{"ok":true,...}`; a test submission appends a row.

Failures are logged and never fail the respondent's request. Re-deploy a new Apps Script version after editing the script. To add another destination (CRM, Zapier), extend `forwardToWebhook()` in `lib/leads.ts`.

## Tracking tags

All three base tags render once from `app/layout.tsx` via `next/script` (the App Router equivalent of pasting them into `<head>`), on every page:

- **Meta Pixel** `2351628112024068` — `components/MetaPixel.tsx`, id in `lib/pixel.ts`. Fires `PageView` on load and a `Lead` event once per valid lead-form submission, tagged `content_name: "speak_with_team"` or `"email_report"` so Ads Manager can split the two CTAs. The event fires only after client-side validation passes (see `fireLeadOnce` in `components/AgencyHealthCheckExperience.tsx`), and never twice for the same CTA in one session (a retry after a network error doesn't re-fire).
- **LinkedIn Insight Tag** partner `8691466` — `components/LinkedInInsight.tsx`, id in `lib/tracking.ts`.
- **Google tag (Ads)** `AW-17879019755` — `components/GoogleTag.tsx`, id in `lib/tracking.ts`. Only one Google tag may be on the page; add further ids with `gtag('config', ...)` inside that component.

The `<noscript>` fallback pixels are rendered server-side only (`dangerouslySetInnerHTML`); rendering them as JSX makes React also create the `<img>` on the client and double-counts `PageView`.

## Attribution (UTMs, click ids, referrer)

`lib/attribution.ts` resolves what a submission is attributed to. Campaign parameters in the current URL (`utm_*`, `gclid`, `fbclid`, `li_fat_id`) always win and are persisted in `localStorage` for 30 days; a later visit that arrives without them (typed the domain, bookmark) falls back to that stored campaign, so return visits keep their source. With neither, the record carries only the external referrer and landing URL. Same-site referrers (reloads) are ignored. Click ids ride along in the `utm` object and land in the sheet's Raw Payload JSON.

## Email (Mailgun)

Sent through `lib/mailgun.ts` (plain HTTP API, no SDK) from `app/api/lead/route.ts`, after the lead is saved:

- **Staff new-lead alert** — `sendLeadNotificationEmail()` in `lib/email.ts`, to `LEAD_NOTIFY_TO` (comma-separated; default `spencer@speedxmedia.com, marketing@speedxmedia.com`). Styled like the app; contains contact details, CTA clicked, public score + archetype, internal score + tier, source/UTMs, pillar bars, strengths/gaps, synthesis, and "Reply to <name>" / "Open leads sheet" buttons. `Reply-To` is the respondent.
- **Respondent report** — `sendAgencyHealthReportEmail()`, **off by default**. Enable with `SEND_RESPONDENT_REPORT=true`. Note: the lead-form CTA ("Get Your Full Agency Health Report Emailed") and the confirmation screen ("We've emailed your full Agency Health Report…") still promise an email — update `lib/copy.ts` if this stays off.

Env vars: `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_REGION` (`us`/`eu`), `MAIL_FROM`, `LEAD_NOTIFY_TO`, `SEND_RESPONDENT_REPORT` — see `.env.example`. Without the first two, sends are logged no-ops. Failures are logged and never fail the request. Builders are pure and covered by `tests/email.test.ts`.

## Known placeholders to fill in before launch

- `lib/copy.ts` — `CTA_HREF` points at a `mailto:` placeholder; swap for the real booking/contact destination (used by both the results-screen CTA and the lead form's "Set Up a Free Strategy Call" button). `COPY.footer.email` is a placeholder company contact address.
- `.env.local` — see `.env.example`. In production `LEAD_WEBHOOK_URL` (sheet) and the `MAILGUN_*` vars (email) must be set.
