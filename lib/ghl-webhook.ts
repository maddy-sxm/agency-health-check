/**
 * GoHighLevel (CRM) lead sync.
 *
 * Every completed submission is POSTed to a GoHighLevel "Inbound Webhook"
 * workflow in the SPEEDXMEDIA sub-account ("Agency Health Check → GHL"),
 * which creates or updates the contact, tags it, assigns the owner, saves
 * the full diagnostic as a note, and opens an opportunity in Marketing
 * Pipeline → New Lead. The keys below are the ones that workflow maps —
 * change them there and here together.
 *
 * This replaces the Google Sheet → Zapier → GoHighLevel hop: the CRM gets
 * the lead straight from the app, after the duplicate guard (lib/dedupe.ts),
 * instead of one CRM write per sheet row. Do not run both at once — the
 * same lead would be written to the CRM twice.
 *
 * Runs server-side only (called from lib/leads.ts). Never throws: a CRM
 * outage must not fail the respondent's request.
 *
 * Configuration: set GHL_WEBHOOK_URL (the workflow trigger's URL) in the
 * hosting project's env vars. Without it this is a silent no-op. The URL is
 * a credential — anyone who has it can write contacts into the CRM — so it
 * lives only in env vars, never in this (public) repository.
 */

import { COPY } from "./copy";
import { DIAGNOSTIC_QUESTIONS, SERVICE_OPTIONS } from "./questions";
import { splitName } from "./sheets-webhook";
import { ROLE_OPTIONS } from "./types";
import type { LeadRecord, PillarResult } from "./types";

/** Per attempt. Two attempts plus the pause stay under the Sheet webhook's own 8s budget (they run in parallel). */
const GHL_TIMEOUT_MS = 3500;
const GHL_ATTEMPTS = 2;
const GHL_RETRY_DELAY_MS = 250;

/** Tag the team already uses for this tool's leads in the CRM — smart lists depend on it. */
export const GHL_TOOL_TAG = "agency rate tool";

/**
 * "live" — a new submission: the workflow creates/updates the contact,
 * assigns the owner and opens the opportunity. "backfill" — a past
 * submission that is already in the CRM: the workflow only finds the
 * contact and adds the tags and the note, so nothing a salesperson has
 * since edited (names, stage, lost/won) is touched. The app only ever
 * sends "live".
 */
export type GhlSyncMode = "live" | "backfill";

/** Flat, string-only payload — what the GoHighLevel workflow maps. */
export interface GhlLeadPayload {
  mode: GhlSyncMode;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  job_title: string;
  /** Traffic source (utm_source, else "direct") — the CRM's "Contact source" / opportunity source. */
  lead_source: string;
  /** Landing URL, with its campaign parameters. */
  source_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  gclid: string;
  fbclid: string;
  li_fat_id: string;
  referrer: string;
  /** Comma-separated; the workflow's dynamic tag field splits on commas. */
  tags: string;
  cta_action: string;
  agency_score: string;
  archetype: string;
  lead_score: string;
  lead_tier: string;
  lowest_pillar: string;
  services: string;
  opportunity_name: string;
  note_title: string;
  note: string;
  submission_id: string;
  submitted_at: string;
  tool: "agency-health-check";
}

function optionLabel(options: readonly { id: string; label: string }[], id: string | undefined): string {
  if (!id) return "";
  return options.find((o) => o.id === id)?.label ?? id;
}

/**
 * US/Canada numbers as E.164 (+1XXXXXXXXXX) so the CRM can match, call and
 * text them. Anything else — international, short, typo'd — is passed
 * through as typed rather than guessed at.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+") && digits.length >= 8) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return trimmed;
}

/**
 * "ahmad malik" -> "Ahmad Malik", "JANE DOE" -> "Jane Doe". Only touches
 * names typed in a single case; mixed case ("McDonald", "de la Cruz") is
 * the respondent's own spelling and is left alone.
 */
export function tidyName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return name;
  const singleCase = name === name.toLowerCase() || name === name.toUpperCase();
  if (!singleCase) return name;
  return name.toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** "Tier 2: Qualified" -> "tier 2". */
function tierTag(classification: string): string {
  const m = classification.match(/tier\s*(\d)/i);
  return m ? `tier ${m[1]}` : "";
}

const CTA_ACTION: Record<LeadRecord["intent"], { label: string; tag: string }> = {
  call: { label: "Strategy call requested", tag: "ahc: strategy call" },
  report: { label: "Full report requested", tag: "ahc: report" },
};

function lowestPillar(pillars: PillarResult[]): PillarResult | undefined {
  return [...pillars].sort((a, b) => a.rawScore - b.rawScore)[0];
}

/** "Nov 16, 2026, 12:00 PM PST" — Pacific, the timezone the CRM is read in. */
function submittedLabel(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return iso;
  return when.toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}

function section(heading: string | null | undefined, lines: string[]): string[] {
  if (!heading || lines.length === 0) return [];
  return ["", `${heading.toUpperCase()}`, ...lines];
}

/** The CRM note: everything sales needs on one card, plain text. */
export function buildGhlNote(record: LeadRecord): string {
  const { publicResult: r, utm } = record;
  const lowest = lowestPillar(r.pillars);
  const services = record.services.map((id) => optionLabel(SERVICE_OPTIONS, id)).join(", ");
  const campaign = [utm.utm_source, utm.utm_medium, utm.utm_campaign].filter(Boolean).join(" / ");

  const answers = DIAGNOSTIC_QUESTIONS.flatMap((q) => {
    const id = record.diagnosticAnswers[q.id];
    return id ? [`- ${q.headline} ${optionLabel(q.options, id)}`] : [];
  });

  const lines: string[] = [
    // Same lines, same order, as the notes the team is used to reading.
    `Lead Tier: ${record.internalClassification}`,
    `Internal Lead Score: ${record.internalLeadScore} / 100`,
    `Agency Score (shown to them): ${r.score} / 100`,
    `Result/Archetype: ${r.tierLabel}`,
    `Lowest Scoring Pillar: ${lowest ? `${lowest.label} (${lowest.rawScore}/6, ${lowest.rating})` : ""}`,
    `Services Selected: ${services || "(none selected)"}`,
    `CTA Action: ${CTA_ACTION[record.intent].label}`,
    `Role: ${optionLabel(ROLE_OPTIONS, record.contact.role)}`,
    ...section("Pillars", r.pillars.map((p) => `- ${p.label}: ${p.rating} (${p.rawScore}/6)`)),
    ...section(r.strengthsHeading, r.strengths.map((s) => `- ${s.phrase}`)),
    ...section(r.weaknessesHeading, r.weaknesses.map((s) => `- ${s.phrase}`)),
    ...section(COPY.results.whatThisMeansHeading, [r.synthesis.whatThisMeans]),
    ...section(COPY.results.recommendationHeading, [r.synthesis.recommendation]),
    ...section("Their answers", answers),
    ...section("Source", [
      `Campaign: ${campaign || "direct / organic"}`,
      ...(utm.utm_term ? [`Term: ${utm.utm_term}`] : []),
      ...(utm.utm_content ? [`Content: ${utm.utm_content}`] : []),
      ...(utm.referrer ? [`Referrer: ${utm.referrer}`] : []),
      ...(utm.landingUrl ? [`Landing page: ${utm.landingUrl}`] : []),
    ]),
    "",
    `Submitted: ${submittedLabel(record.createdAt)}`,
    `Submission ID: ${record.leadId}`,
  ];
  return lines.join("\n");
}

/** Pure mapping from a persisted LeadRecord to the workflow's payload. */
export function buildGhlLeadPayload(record: LeadRecord, mode: GhlSyncMode = "live"): GhlLeadPayload {
  const { contact, publicResult: r, utm } = record;
  const fullName = tidyName(contact.name);
  const [firstName, lastName] = splitName(fullName);
  const lowest = lowestPillar(r.pillars);
  const cta = CTA_ACTION[record.intent];
  const tags = [GHL_TOOL_TAG, cta.tag, tierTag(record.internalClassification) && `ahc: ${tierTag(record.internalClassification)}`].filter(Boolean);

  return {
    mode,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    email: contact.email.trim().toLowerCase(),
    phone: normalizePhone(contact.phone),
    job_title: optionLabel(ROLE_OPTIONS, contact.role),
    lead_source: utm.utm_source?.trim() || "direct",
    source_url: utm.landingUrl ?? "",
    utm_source: utm.utm_source ?? "",
    utm_medium: utm.utm_medium ?? "",
    utm_campaign: utm.utm_campaign ?? "",
    utm_term: utm.utm_term ?? "",
    utm_content: utm.utm_content ?? "",
    gclid: utm.gclid ?? "",
    fbclid: utm.fbclid ?? "",
    li_fat_id: utm.li_fat_id ?? "",
    referrer: utm.referrer ?? "",
    tags: tags.join(", "),
    cta_action: cta.label,
    agency_score: String(r.score),
    archetype: r.tierLabel,
    lead_score: String(record.internalLeadScore),
    lead_tier: record.internalClassification,
    lowest_pillar: lowest?.label ?? "",
    services: record.services.map((id) => optionLabel(SERVICE_OPTIONS, id)).join(", "),
    opportunity_name: `${fullName} - Agency Health Check (${record.internalClassification})`,
    note_title: `Agency Health Check: ${r.tierLabel} · ${record.internalClassification}`,
    note: buildGhlNote(record),
    submission_id: record.leadId,
    submitted_at: record.createdAt,
    tool: "agency-health-check",
  };
}

/** The configured workflow URL, or null. Must be https — the payload is personal data. */
export function ghlWebhookUrl(env: Record<string, string | undefined> = process.env): string | null {
  const url = env.GHL_WEBHOOK_URL?.trim();
  return url && url.startsWith("https://") ? url : null;
}

export interface GhlForwardOptions {
  /** Overrides GHL_WEBHOOK_URL — for tests and one-off scripts. */
  url?: string | null;
  /** Defaults to "live". See GhlSyncMode. */
  mode?: GhlSyncMode;
  fetchImpl?: typeof fetch;
  retryDelayMs?: number;
}

/**
 * POST the lead to the GoHighLevel workflow. Resolves to true when
 * GoHighLevel accepted it, false otherwise (including "not configured").
 * A network error, timeout, 429 or 5xx is retried once; a 4xx is a
 * configuration problem and is not. Never throws.
 */
export async function forwardLeadToGhl(record: LeadRecord, options: GhlForwardOptions = {}): Promise<boolean> {
  const url = options.url === undefined ? ghlWebhookUrl() : options.url;
  if (!url) return false; // Not configured: nothing to send, nothing to warn about.

  const doFetch = options.fetchImpl ?? fetch;
  const body = JSON.stringify(buildGhlLeadPayload(record, options.mode ?? "live"));

  for (let attempt = 1; attempt <= GHL_ATTEMPTS; attempt++) {
    let retryable = true;
    try {
      const res = await doFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(GHL_TIMEOUT_MS),
      });
      if (res.ok) return true;
      retryable = res.status === 429 || res.status >= 500;
      console.error(
        `[agency-health-check] GoHighLevel webhook HTTP ${res.status} for lead ${record.leadId} (attempt ${attempt}/${GHL_ATTEMPTS}): ${(await res.text()).slice(0, 200)}`
      );
    } catch (err) {
      console.error(`[agency-health-check] GoHighLevel webhook failed for lead ${record.leadId} (attempt ${attempt}/${GHL_ATTEMPTS}):`, err);
    }
    if (!retryable) break;
    if (attempt < GHL_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs ?? GHL_RETRY_DELAY_MS));
  }
  return false;
}
