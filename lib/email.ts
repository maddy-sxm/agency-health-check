/**
 * Outbound email for a completed submission — two messages per lead:
 *
 *  1. sendLeadNotificationEmail(): the INTERNAL "new lead" alert to the
 *     SPEEDX team (LEAD_NOTIFY_TO, comma-separated; defaults to
 *     DEFAULT_LEAD_NOTIFY_TO). Carries everything sales needs to act,
 *     including the internal score the respondent never sees, and sets
 *     Reply-To to the respondent so a reply goes straight to them.
 *  2. sendAgencyHealthReportEmail(): the respondent's full report — the
 *     pillar breakdown, strengths, gaps, and synthesis the confirmation
 *     screen promises ("We've emailed your full Agency Health Report…").
 *
 * Both go through lib/mailgun.ts and are no-ops (with a logged warning)
 * until Mailgun is configured. Neither ever throws: the lead is already in
 * Redis / the Sheet by the time these run, and a mail failure must not fail
 * the respondent's request.
 */

import { COPY } from "./copy";
import { parseRecipientList, sendMail } from "./mailgun";
import { QUALIFICATION_QUESTIONS, SERVICE_OPTIONS } from "./questions";
import { ROLE_OPTIONS } from "./types";
import type { LeadRecord } from "./types";

/** Who gets the internal alert when LEAD_NOTIFY_TO isn't set. */
export const DEFAULT_LEAD_NOTIFY_TO = ["spencer@speedxmedia.com", "leads@speedxmedia.com"];

const LEADS_SHEET_URL = "https://docs.google.com/spreadsheets/d/1OJRt-0Ua6n_9OrGa9R-TlSp4KofjDi4QndZJJZm2X88/edit";

function label(options: readonly { id: string; label: string }[], id: string | undefined): string {
  if (!id) return "";
  return options.find((o) => o.id === id)?.label ?? id;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ------------------------------------------------------------------ */
/* Respondent report                                                   */
/* ------------------------------------------------------------------ */

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

export async function sendAgencyHealthReportEmail(record: LeadRecord): Promise<boolean> {
  const firstName = record.contact.name.trim().split(/\s+/)[0] || "there";
  const text = [
    `Hi ${firstName},`,
    "",
    "Thanks for completing the SPEEDXMEDIA Agency Health Check. Your full report is below.",
    "",
    buildReportEmailBody(record),
    "",
    `Want to talk it through? Reply to this email or reach us at ${COPY.footer.email}.`,
    "",
    COPY.footer.name,
  ].join("\n");
  return sendMail(
    { to: [record.contact.email], subject: `Your Agency Health Report — ${record.publicResult.tierLabel}`, text, replyTo: COPY.footer.email },
    `report email for lead ${record.leadId}`
  );
}

/* ------------------------------------------------------------------ */
/* Internal lead notification                                          */
/* ------------------------------------------------------------------ */

export interface LeadNotification {
  subject: string;
  text: string;
  html: string;
  replyTo: string;
}

const CTA_LABEL: Record<LeadRecord["intent"], string> = { report: "Report Emailed", call: "Strategy Call" };

/** Pure builder for the internal alert — tested in tests/email.test.ts. */
export function buildLeadNotification(record: LeadRecord): LeadNotification {
  const { contact, publicResult: r } = record;
  const marketingSpend = QUALIFICATION_QUESTIONS.find((q) => q.id === "marketingSpend");
  const cta = CTA_LABEL[record.intent];
  const lowest = [...r.pillars].sort((a, b) => a.rawScore - b.rawScore)[0];

  const rows: Array<[string, string]> = [
    ["Name", contact.name],
    ["Email", contact.email],
    ["Phone", contact.phone],
    ["Role", label(ROLE_OPTIONS, contact.role)],
    ["Services their agency provides", record.services.map((id) => label(SERVICE_OPTIONS, id)).join(", ") || "(none selected)"],
    ["Monthly marketing budget", label(marketingSpend?.options ?? [], record.qualificationAnswers.marketingSpend) || "(not asked)"],
    ["CTA clicked", cta],
    ["Agency Health Score (shown to them)", `${r.score} / 100 — ${r.tierLabel}`],
    ["Internal lead score", `${record.internalLeadScore} — ${record.internalClassification}`],
    ["Lowest pillar", lowest ? `${lowest.label} (${lowest.rawScore}/6, ${lowest.rating})` : ""],
    ["Source", [record.utm.utm_source, record.utm.utm_medium, record.utm.utm_campaign].filter(Boolean).join(" / ") || "direct / organic"],
    ["Referrer", record.utm.referrer || ""],
    ["Landing page", record.utm.landingUrl || ""],
    ["Submitted", record.createdAt],
    ["Submission ID", record.leadId],
  ];

  const text = [
    `New Agency Health Check lead — ${cta}`,
    "",
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    "",
    "Diagnostic breakdown (what the report says):",
    buildReportEmailBody(record),
    "",
    `All leads: ${LEADS_SHEET_URL}`,
  ].join("\n");

  const html = [
    `<h2 style="margin:0 0 12px">New Agency Health Check lead — ${escapeHtml(cta)}</h2>`,
    `<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">`,
    ...rows
      .filter(([, v]) => v)
      .map(([k, v]) => `<tr><td style="color:#666;white-space:nowrap;vertical-align:top">${escapeHtml(k)}</td><td><strong>${escapeHtml(v)}</strong></td></tr>`),
    `</table>`,
    `<h3 style="margin:20px 0 8px">Diagnostic breakdown</h3>`,
    `<pre style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">${escapeHtml(buildReportEmailBody(record))}</pre>`,
    `<p><a href="${LEADS_SHEET_URL}">Open the leads sheet</a></p>`,
  ].join("\n");

  return {
    subject: `New Agency Health Check lead: ${contact.name} — ${record.internalClassification} (${cta})`,
    text,
    html,
    replyTo: contact.email,
  };
}

/** Internal alert to the SPEEDX team. Recipients: LEAD_NOTIFY_TO env, else DEFAULT_LEAD_NOTIFY_TO. */
export async function sendLeadNotificationEmail(record: LeadRecord): Promise<boolean> {
  const to = parseRecipientList(process.env.LEAD_NOTIFY_TO);
  const recipients = to.length ? to : DEFAULT_LEAD_NOTIFY_TO;
  const n = buildLeadNotification(record);
  return sendMail({ to: recipients, subject: n.subject, text: n.text, html: n.html, replyTo: n.replyTo }, `lead notification for ${record.leadId}`);
}
