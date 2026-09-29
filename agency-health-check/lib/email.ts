/**
 * Report-delivery email. Called from app/api/lead/route.ts for every lead
 * submission, regardless of which lead-form CTA the respondent chose — the
 * report and "set up a call" paths are additive, not alternatives.
 *
 * Same placeholder convention as lib/pixel.ts (PIXEL_ID) and
 * lib/leads.ts (forwardToWebhook): the integration point is real and
 * called at the right time, but actually sending mail needs a provider
 * (Resend, Postmark, SendGrid, etc.) wired in before launch. Until then
 * this logs a warning instead of throwing, so the rest of the flow keeps
 * working in local dev.
 *
 * ============================================================================
 * WIRING UP A REAL PROVIDER
 * ============================================================================
 * Replace the body of sendAgencyHealthReportEmail() with a real API call,
 * e.g. (Resend):
 *   await resend.emails.send({
 *     from: "Agency Health Check <report@speedxmedia.com>",
 *     to: record.contact.email,
 *     subject: "Your Agency Health Report",
 *     text: buildReportEmailBody(record),
 *   });
 * buildReportEmailBody() below already assembles the full report text from
 * the same data the results page would have shown — nothing else in the
 * app needs to change.
 * ============================================================================
 */

import { COPY } from "./copy";
import type { LeadRecord } from "./types";

/** Plain-text report body — the pillar breakdown, strengths, gaps, and
 *  synthesis that used to render directly on the results screen now live
 *  here instead, since the full report is delivered by email. */
export function buildReportEmailBody(record: LeadRecord): string {
  const { publicResult: r, contact } = record;

  const pillarLines = r.pillars.map((p) => `  - ${p.label}: ${p.rating}`).join("\n");
  const strengthLines = r.strengths.length ? r.strengths.map((s) => `  - ${s.phrase}`).join("\n") : "  (none noted)";
  const weaknessLines = r.weaknesses.length ? r.weaknesses.map((s) => `  - ${s.phrase}`).join("\n") : "  (none noted)";

  return [
    `Agency Health Score: ${r.score} / 100 — ${r.tierLabel}`,
    r.tierMessage,
    "",
    `${COPY.results.pillarsHeading}:`,
    pillarLines,
    "",
    ...(r.strengthsHeading ? [`${r.strengthsHeading}:`, strengthLines, ""] : []),
    ...(r.weaknessesHeading ? [`${r.weaknessesHeading}:`, weaknessLines, ""] : []),
    `${COPY.results.whatThisMeansHeading}:`,
    r.synthesis.whatThisMeans,
    "",
    `${COPY.results.recommendationHeading}:`,
    r.synthesis.recommendation,
    "",
    `Prepared for ${contact.name} (${contact.email}, ${contact.phone})`,
  ].join("\n");
}

export async function sendAgencyHealthReportEmail(record: LeadRecord): Promise<void> {
  // No-op for now — see the file comment for how to wire in a real provider.
  console.warn(
    `[agency-health-check] Email delivery not configured — the full report for lead ${record.leadId} ` +
      `(${record.contact.email}) was NOT sent. This is expected until a real provider is wired up in lib/email.ts.`
  );
  void buildReportEmailBody(record);
}
