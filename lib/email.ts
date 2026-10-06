/**
 * Outbound email for a completed submission.
 *
 *  - sendLeadNotificationEmail(): the STAFF "new lead" alert — the one email
 *    that matters. Goes to LEAD_NOTIFY_TO (comma-separated; defaults to
 *    DEFAULT_LEAD_NOTIFY_TO). Styled like the app (dark ground, coral
 *    accent, uppercase display type) and carries everything sales needs to
 *    act: contact details, CTA clicked, public score + archetype, internal
 *    score + tier, source/UTMs, the full diagnostic breakdown, and one-click
 *    reply / open-sheet buttons. Reply-To is the respondent.
 *  - sendAgencyHealthReportEmail(): the respondent's own report. OFF by
 *    default (product decision 2026-10-05: no client-facing email); enable
 *    with SEND_RESPONDENT_REPORT=true. Note the UI copy still promises an
 *    emailed report — see README "Email".
 *
 * Both go through lib/mailgun.ts and are logged no-ops until Mailgun is
 * configured. Neither ever throws: the lead is already in Redis / the Sheet
 * by the time these run, and a mail failure must not fail the request.
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
  if ((process.env.SEND_RESPONDENT_REPORT ?? "").trim().toLowerCase() !== "true") return false;
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
/* Staff lead notification                                             */
/* ------------------------------------------------------------------ */

export interface LeadNotification {
  subject: string;
  text: string;
  html: string;
  replyTo: string;
}

const CTA_LABEL: Record<LeadRecord["intent"], string> = { report: "Report Emailed", call: "Strategy Call" };

/** App palette (tailwind.config.ts) — inline because email clients ignore stylesheets. */
const C = {
  ink: "#000000",
  ink2: "#0d0d0d",
  ink3: "#171717",
  line: "#2a2a2a",
  red: "#d9573b",
  redBright: "#ff6b4a",
  bone: "#f5f5f5",
  smoke: "#8f8f8f",
  keepBright: "#2ee27f",
  amberBright: "#ffc266",
} as const;
const DISPLAY_FONT = "'Arial Black', 'Archivo', Arial, Helvetica, sans-serif";
const SANS_FONT = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO_FONT = "'JetBrains Mono', Menlo, Consolas, monospace";
const LOGO_URL = "https://agency-health-check.speedxmedia.com/speedxmedia-logo.png";

const RATING_COLOR: Record<string, string> = {
  Strong: C.keepBright,
  Developing: C.amberBright,
  "At Risk": C.redBright,
  Critical: C.redBright,
};

function eyebrow(text: string, color: string = C.smoke): string {
  return `<div style="font-family:${MONO_FONT};font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${color};">${escapeHtml(text)}</div>`;
}

function pillarRow(p: LeadRecord["publicResult"]["pillars"][number]): string {
  const color = RATING_COLOR[p.rating] ?? C.smoke;
  const cells = Array.from({ length: 6 }, (_, i) =>
    `<td style="height:6px;background:${i < p.rawScore ? color : C.line};border-radius:3px;${i < 5 ? "padding-right:3px;" : ""}"></td>`
  ).join("");
  return `
    <tr><td style="padding:14px 0;border-top:1px solid ${C.line};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font-family:${SANS_FONT};font-size:14px;font-weight:600;color:${C.bone};">${escapeHtml(p.label)}</td>
        <td align="right" style="font-family:${MONO_FONT};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${color};white-space:nowrap;">${escapeHtml(p.rating)} &nbsp;<span style="color:${C.smoke};">${p.rawScore}/6</span></td>
      </tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;border-collapse:separate;"><tr>${cells}</tr></table>
    </td></tr>`;
}

function listRows(items: { phrase: string }[], marker: string, color: string): string {
  return items
    .map(
      (s) => `<tr><td style="padding:6px 0;font-family:${SANS_FONT};font-size:14px;line-height:1.5;color:${C.bone};">
        <span style="color:${color};font-weight:700;">${marker}</span>&nbsp; ${escapeHtml(s.phrase)}</td></tr>`
    )
    .join("");
}

function button(href: string, label: string, filled: boolean): string {
  const style = filled
    ? `background:${C.red};color:#ffffff;border:2px solid ${C.red};`
    : `background:transparent;color:${C.bone};border:2px solid ${C.line};`;
  return `<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;border-radius:7px;font-family:${SANS_FONT};font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;text-decoration:none;${style}">${escapeHtml(label)}</a>`;
}

function kv(label: string, value: string, href?: string): string {
  const v = href ? `<a href="${escapeHtml(href)}" style="color:${C.bone};text-decoration:underline;">${escapeHtml(value)}</a>` : escapeHtml(value);
  return `<tr>
    <td style="padding:6px 12px 6px 0;font-family:${MONO_FONT};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${C.smoke};white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;font-family:${SANS_FONT};font-size:14px;color:${C.bone};">${v}</td>
  </tr>`;
}

/** Pure builder for the staff alert — tested in tests/email.test.ts. */
export function buildLeadNotification(record: LeadRecord): LeadNotification {
  const { contact, publicResult: r } = record;
  const cta = CTA_LABEL[record.intent];
  const roleLabel = label(ROLE_OPTIONS, contact.role);
  const services = record.services.map((id) => label(SERVICE_OPTIONS, id)).join(", ") || "(none selected)";
  const marketingSpend = label(QUALIFICATION_QUESTIONS.find((q) => q.id === "marketingSpend")?.options ?? [], record.qualificationAnswers.marketingSpend);
  const source = [record.utm.utm_source, record.utm.utm_medium, record.utm.utm_campaign].filter(Boolean).join(" / ") || "direct / organic";
  const lowest = [...r.pillars].sort((a, b) => a.rawScore - b.rawScore)[0];
  const firstName = contact.name.trim().split(/\s+/)[0] || "them";
  const when = new Date(record.createdAt);
  const whenLabel = Number.isNaN(when.getTime())
    ? record.createdAt
    : when.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const replyHref = `mailto:${contact.email}?subject=${encodeURIComponent("Your Agency Health Check results — SPEEDXMEDIA")}`;
  const preheader = `${roleLabel} · ${record.internalClassification} · ${cta} · Agency score ${r.score}, ${r.tierLabel}`;

  const rows: Array<[string, string]> = [
    ["Name", contact.name],
    ["Email", contact.email],
    ["Phone", contact.phone],
    ["Role", roleLabel],
    ["Their agency provides", services],
    ...(marketingSpend ? [["Monthly marketing budget", marketingSpend] as [string, string]] : []),
    ["CTA clicked", cta],
    ["Agency Health Score (shown to them)", `${r.score} / 100 — ${r.tierLabel}`],
    ["Internal lead score", `${record.internalLeadScore} — ${record.internalClassification}`],
    ["Lowest pillar", lowest ? `${lowest.label} (${lowest.rawScore}/6, ${lowest.rating})` : ""],
    ["Source", source],
    ["Referrer", record.utm.referrer || ""],
    ["Landing page", record.utm.landingUrl || ""],
    ["Submitted", whenLabel],
    ["Submission ID", record.leadId],
  ];

  const text = [
    `NEW LEAD — Agency Health Check (${cta})`,
    "",
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    "",
    "Diagnostic breakdown:",
    buildReportEmailBody(record),
    "",
    `Reply to ${firstName}: ${contact.email}`,
    `All leads: ${LEADS_SHEET_URL}`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${escapeHtml(`New lead: ${contact.name}`)}</title></head>
<body style="margin:0;padding:0;background:${C.ink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.ink};">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.ink};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${C.ink2};border:1px solid ${C.line};border-radius:14px;">

  <tr><td align="center" style="padding:22px 24px;border-bottom:1px solid ${C.line};">
    <img src="${LOGO_URL}" alt="SPEEDXMEDIA" width="150" style="display:block;width:150px;height:auto;border:0;">
  </td></tr>

  <tr><td style="padding:28px 28px 8px;">
    ${eyebrow("New lead · Agency Health Check", C.red)}
    <div style="margin-top:10px;font-family:${DISPLAY_FONT};font-size:30px;line-height:1.05;font-weight:900;text-transform:uppercase;color:${C.bone};">${escapeHtml(contact.name)}</div>
    <div style="margin-top:8px;font-family:${SANS_FONT};font-size:15px;color:${C.smoke};">${escapeHtml(roleLabel)}</div>
    <div style="margin-top:14px;">
      <span style="display:inline-block;padding:6px 12px;border:1px solid ${C.red};border-radius:999px;background:rgba(217,87,59,0.12);font-family:${MONO_FONT};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${C.redBright};">${escapeHtml(cta)}</span>
      <span style="display:inline-block;padding:6px 12px;border:1px solid ${C.line};border-radius:999px;font-family:${MONO_FONT};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${C.bone};">${escapeHtml(record.internalClassification)}</span>
    </div>
  </td></tr>

  <tr><td style="padding:16px 28px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="50%" style="padding:16px;background:${C.ink};border:1px solid ${C.line};border-radius:12px;">
        ${eyebrow("Internal lead score")}
        <div style="margin-top:6px;font-family:${DISPLAY_FONT};font-size:36px;line-height:1;font-weight:900;color:${C.redBright};">${record.internalLeadScore}<span style="font-size:14px;color:${C.smoke};">/100</span></div>
        <div style="margin-top:6px;font-family:${SANS_FONT};font-size:13px;color:${C.bone};">${escapeHtml(record.internalClassification)}</div>
      </td>
      <td width="12"></td>
      <td width="50%" style="padding:16px;background:${C.ink};border:1px solid ${C.line};border-radius:12px;">
        ${eyebrow("Agency score they saw")}
        <div style="margin-top:6px;font-family:${DISPLAY_FONT};font-size:36px;line-height:1;font-weight:900;color:${C.bone};">${r.score}<span style="font-size:14px;color:${C.smoke};">/100</span></div>
        <div style="margin-top:6px;font-family:${SANS_FONT};font-size:13px;color:${C.bone};text-transform:uppercase;">${escapeHtml(r.tierLabel)}</div>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:24px 28px 0;">
    ${button(replyHref, `Reply to ${firstName}`, true)}&nbsp;&nbsp;${button(LEADS_SHEET_URL, "Open leads sheet", false)}
  </td></tr>

  <tr><td style="padding:28px 28px 0;">
    ${eyebrow("Contact & context")}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
      ${kv("Email", contact.email, `mailto:${contact.email}`)}
      ${kv("Phone", contact.phone, `tel:${contact.phone.replace(/[^+\d]/g, "")}`)}
      ${kv("Agency provides", services)}
      ${marketingSpend ? kv("Marketing budget", marketingSpend) : ""}
      ${kv("Source", source)}
      ${record.utm.referrer ? kv("Referrer", record.utm.referrer) : ""}
      ${kv("Submitted", whenLabel)}
    </table>
  </td></tr>

  <tr><td style="padding:28px 28px 0;">
    ${eyebrow("Diagnostic pillars")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">
      ${r.pillars.map(pillarRow).join("")}
    </table>
  </td></tr>

  ${
    r.strengthsHeading
      ? `<tr><td style="padding:24px 28px 0;">${eyebrow(r.strengthsHeading, C.keepBright)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">${listRows(r.strengths, "✓", C.keepBright)}</table></td></tr>`
      : ""
  }
  ${
    r.weaknessesHeading
      ? `<tr><td style="padding:20px 28px 0;">${eyebrow(r.weaknessesHeading, C.redBright)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">${listRows(r.weaknesses, "●", C.redBright)}</table></td></tr>`
      : ""
  }

  <tr><td style="padding:24px 28px 0;">
    ${eyebrow(COPY.results.whatThisMeansHeading)}
    <p style="margin:8px 0 0;font-family:${SANS_FONT};font-size:14px;line-height:1.6;color:${C.bone};">${escapeHtml(r.synthesis.whatThisMeans)}</p>
  </td></tr>
  <tr><td style="padding:20px 28px 0;">
    ${eyebrow(COPY.results.recommendationHeading)}
    <p style="margin:8px 0 0;font-family:${SANS_FONT};font-size:14px;line-height:1.6;color:${C.bone};">${escapeHtml(r.synthesis.recommendation)}</p>
  </td></tr>

  <tr><td style="padding:28px 28px 24px;">
    <div style="border-top:1px solid ${C.line};padding-top:16px;font-family:${MONO_FONT};font-size:10px;line-height:1.7;letter-spacing:0.04em;color:${C.smoke};">
      Submission ${escapeHtml(record.leadId)}<br>
      ${record.utm.landingUrl ? `Landing page: ${escapeHtml(record.utm.landingUrl)}<br>` : ""}
      Sent by the Agency Health Check tool · replies go to the lead
    </div>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  return {
    subject: `New lead: ${contact.name} (${roleLabel}) — ${record.internalClassification} · ${cta}`,
    text,
    html,
    replyTo: contact.email,
  };
}

/** Staff alert. Recipients: LEAD_NOTIFY_TO env, else DEFAULT_LEAD_NOTIFY_TO. */
export async function sendLeadNotificationEmail(record: LeadRecord): Promise<boolean> {
  const to = parseRecipientList(process.env.LEAD_NOTIFY_TO);
  const recipients = to.length ? to : DEFAULT_LEAD_NOTIFY_TO;
  const n = buildLeadNotification(record);
  return sendMail({ to: recipients, subject: n.subject, text: n.text, html: n.html, replyTo: n.replyTo }, `lead notification for ${record.leadId}`);
}
