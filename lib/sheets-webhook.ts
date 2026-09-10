/**
 * Google Sheets lead sync.
 *
 * Every completed submission is POSTed to a Google Apps Script web app
 * (see scripts/google-sheets-webhook.gs), which appends one row to the
 * "Agency Tool Leads" tab of the SPEEDX lead sheet. The payload keys below
 * match the "Webhook Setup" tab of that sheet exactly — change them there
 * and here together.
 *
 * Runs server-side only (called from lib/leads.ts, which is only imported
 * by API route handlers). Never throws: a Sheets outage must not fail the
 * respondent's request, since the lead may already be persisted in Redis.
 *
 * Configuration: set LEAD_WEBHOOK_URL (the Apps Script "Web app" URL) in
 * the hosting project's env vars. Without it this logs a warning and no-ops.
 */

import { PILLARS } from "./pillars";
import { DIAGNOSTIC_QUESTIONS, QUALIFICATION_QUESTIONS, SERVICE_OPTIONS } from "./questions";
import { ROLE_OPTIONS } from "./types";
import type { LeadRecord, PillarResult } from "./types";

const WEBHOOK_TIMEOUT_MS = 8000;

export interface SheetLeadPayload {
  submittedAt: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  jobTitle: string;
  monthlyMarketingBudget: string;
  currentAgency: string;
  services: string[];
  agencyScore: number;
  leadScore: number;
  leadTier: string;
  archetype: string;
  lowestPillar: string;
  lowestPillarScore: number;
  ctaAction: string;
  source: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  referrer: string;
  landingPage: string;
  submissionId: string;
  answers: Record<string, unknown>;
  pillarScores: Record<string, { score: number; rating: string }>;
  rawPayload: LeadRecord;
}

/** "Jane Q. Public" -> ["Jane", "Q. Public"]; single-word names keep an empty last name. */
export function splitName(fullName: string): [string, string] {
  const trimmed = fullName.trim().replace(/\s+/g, " ");
  const idx = trimmed.indexOf(" ");
  if (idx === -1) return [trimmed, ""];
  return [trimmed.slice(0, idx), trimmed.slice(idx + 1)];
}

function optionLabel(options: readonly { id: string; label: string }[], id: string | undefined): string {
  if (!id) return "";
  return options.find((o) => o.id === id)?.label ?? id;
}

const CTA_ACTION_LABEL: Record<LeadRecord["intent"], string> = {
  report: "Report Emailed",
  call: "Strategy Call",
};

function lowestPillar(pillars: PillarResult[]): PillarResult | undefined {
  return [...pillars].sort((a, b) => a.rawScore - b.rawScore)[0];
}

/** Pure mapping from a persisted LeadRecord to the sheet's payload shape. */
export function buildSheetLeadPayload(record: LeadRecord): SheetLeadPayload {
  const [firstName, lastName] = splitName(record.contact.name);
  const lowest = lowestPillar(record.publicResult.pillars);

  const diagnosticAnswers: Record<string, string> = {};
  for (const q of DIAGNOSTIC_QUESTIONS) {
    const id = record.diagnosticAnswers[q.id];
    if (id) diagnosticAnswers[q.id] = optionLabel(q.options, id);
  }
  const qualificationAnswers: Record<string, string> = {};
  for (const q of QUALIFICATION_QUESTIONS) {
    const id = record.qualificationAnswers[q.id];
    if (id) qualificationAnswers[q.id] = optionLabel(q.options, id);
  }

  const pillarScores: SheetLeadPayload["pillarScores"] = {};
  for (const p of record.publicResult.pillars) {
    pillarScores[p.label] = { score: p.rawScore, rating: p.rating };
  }

  const marketingSpendQuestion = QUALIFICATION_QUESTIONS.find((q) => q.id === "marketingSpend");

  return {
    submittedAt: record.createdAt,
    firstName,
    lastName,
    email: record.contact.email,
    phone: record.contact.phone,
    // Not collected by the assessment today — kept so the sheet's columns
    // line up if the form ever grows.
    company: "",
    website: "",
    jobTitle: optionLabel(ROLE_OPTIONS, record.contact.role),
    monthlyMarketingBudget: optionLabel(marketingSpendQuestion?.options ?? [], record.qualificationAnswers.marketingSpend),
    currentAgency: "",
    services: record.services.map((id) => optionLabel(SERVICE_OPTIONS, id)),
    agencyScore: record.publicResult.score,
    leadScore: record.internalLeadScore,
    leadTier: record.internalClassification,
    archetype: record.publicResult.tierLabel,
    lowestPillar: lowest?.label ?? "",
    lowestPillarScore: lowest?.rawScore ?? 0,
    ctaAction: CTA_ACTION_LABEL[record.intent],
    source: record.source,
    utmSource: record.utm.utm_source ?? "",
    utmMedium: record.utm.utm_medium ?? "",
    utmCampaign: record.utm.utm_campaign ?? "",
    utmContent: record.utm.utm_content ?? "",
    utmTerm: record.utm.utm_term ?? "",
    referrer: record.utm.referrer ?? "",
    landingPage: record.utm.landingUrl ?? "",
    submissionId: record.leadId,
    answers: { diagnostic: diagnosticAnswers, qualification: qualificationAnswers },
    pillarScores,
    rawPayload: record,
  };
}

/**
 * POST the lead to the Google Sheets webhook. Resolves to true when the
 * sheet acknowledged the row, false otherwise. Never throws.
 */
export async function forwardLeadToSheet(record: LeadRecord): Promise<boolean> {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) {
    console.warn(
      `[agency-health-check] LEAD_WEBHOOK_URL not set — lead ${record.leadId} was NOT sent to the Google Sheet.`
    );
    return false;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSheetLeadPayload(record)),
      // Apps Script web apps answer via a 302 to script.googleusercontent.com;
      // fetch follows it by default.
      redirect: "follow",
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    const text = await res.text();
    let ok = res.ok;
    try {
      const body = JSON.parse(text) as { ok?: boolean; error?: string };
      if (body.ok === false) {
        ok = false;
        console.error(`[agency-health-check] Sheet webhook rejected lead ${record.leadId}: ${body.error ?? "unknown"}`);
      }
    } catch {
      // Non-JSON body (e.g. an HTML error page from Google) — fall back to the HTTP status.
    }
    if (!res.ok) {
      console.error(`[agency-health-check] Sheet webhook HTTP ${res.status} for lead ${record.leadId}: ${text.slice(0, 200)}`);
    }
    return ok;
  } catch (err) {
    console.error(`[agency-health-check] Sheet webhook failed for lead ${record.leadId}:`, err);
    return false;
  }
}
