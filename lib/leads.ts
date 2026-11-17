/**
 * Redis-backed lead storage (Upstash, via Vercel's Marketplace integration).
 * Same pattern as the sibling tools (see payment-match-tool/lib/leads.ts) —
 * a local-JSON-file approach breaks in production because Vercel's
 * serverless functions run on a read-only filesystem.
 *
 * Keys are prefixed `agency-health-check:` so this can share the SAME
 * Redis instance as exotic-match-tool / lease-match-tool / drive-match-tool
 * / monthly-lineup-tool / payment-match-tool without key collisions.
 *
 * IMPORTANT — this prefix must stay unique to this tool. Before treating
 * this file as safe in a shared Redis instance, verify there are zero
 * existing keys under `agency-health-check:*`.
 *
 * Local dev without KV_REST_API_URL / KV_REST_API_TOKEN set: saveLead()
 * logs a warning and no-ops instead of throwing, so the assessment flow can
 * be built and tested end-to-end before real Upstash credentials exist.
 * Production MUST have these set — see README.md.
 *
 * ============================================================================
 * DOWNSTREAM DELIVERY (Google Sheets + GoHighLevel)
 * ============================================================================
 * Every saved lead is also sent downstream by `forwardToWebhook()` below:
 *  - the SPEEDX Google Sheet — lib/sheets-webhook.ts for the payload
 *    mapping, scripts/google-sheets-webhook.gs for the receiving Apps Script;
 *  - the GoHighLevel CRM — lib/ghl-webhook.ts (contact, tags, note and an
 *    opportunity in Marketing Pipeline → New Lead).
 * Both run whether or not Redis is configured, in parallel, and each is a
 * no-op until its env var is set (LEAD_WEBHOOK_URL / GHL_WEBHOOK_URL). To
 * add another destination, extend `forwardToWebhook()`.
 * ============================================================================
 */

import { Redis } from "@upstash/redis";
import { isDuplicateSubmission, shortenDuplicateReservation } from "./dedupe";
import { forwardLeadToGhl } from "./ghl-webhook";
import type { GhlDeliveryOutcome } from "./ghl-webhook";
import { forwardLeadToSheet } from "./sheets-webhook";
import type { LeadRecord } from "./types";

const KEY_PREFIX = "agency-health-check";
const LEADS_INDEX_KEY = `${KEY_PREFIX}:leads:index`;

function leadKey(leadId: string): string {
  return `${KEY_PREFIX}:lead:${leadId}`;
}

let cachedClient: Redis | null | undefined;

function redis(): Redis | null {
  if (cachedClient !== undefined) return cachedClient;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    cachedClient = null;
    return null;
  }
  cachedClient = new Redis({ url, token });
  return cachedClient;
}

/**
 * Fan-out to every downstream destination, in parallel. Each target
 * swallows its own errors — a failure here must never fail the respondent's
 * request — and reports what happened.
 *
 * `undelivered` is true only when NO destination took the lead and at least
 * one of them failed in a way a retry could fix (a Sheet transport error, or
 * a CRM network error / 429 / 5xx). A CRM 4xx is a configuration problem,
 * and one destination failing while the other succeeded still leaves the
 * lead recorded — neither should loosen the duplicate guard.
 */
async function forwardToWebhook(record: LeadRecord): Promise<{ undelivered: boolean }> {
  const [sheetOk, ghl] = await Promise.all([forwardLeadToSheet(record), forwardLeadToGhl(record)]);
  return { undelivered: leadWentUndelivered({ ok: sheetOk, configured: Boolean(process.env.LEAD_WEBHOOK_URL) }, ghl) };
}

/** The rule above, pure — tested in tests/leads.test.ts. */
export function leadWentUndelivered(sheet: { ok: boolean; configured: boolean }, ghl: GhlDeliveryOutcome): boolean {
  const delivered = sheet.ok || ghl === "delivered";
  const retryCouldHelp = (!sheet.ok && sheet.configured) || ghl === "failed";
  return !delivered && retryCouldHelp;
}

/**
 * Persist the lead and fan it out. Returns whether downstream delivery (Sheet,
 * CRM, staff email) should run: false when an identical submission was
 * already processed in the last few minutes — the record is still stored in
 * Redis so nothing is lost, but the team isn't told twice. See lib/dedupe.ts.
 */
export async function saveLead(record: LeadRecord): Promise<{ duplicate: boolean }> {
  const client = redis();
  if (!client) {
    console.warn(
      `[agency-health-check] KV_REST_API_URL / KV_REST_API_TOKEN not set — lead ${record.leadId} was NOT persisted to Redis. ` +
        "This is expected in local dev without Upstash credentials; it must be fixed before production launch."
    );
  } else {
    try {
      await client.set(leadKey(record.leadId), record);
      await client.rpush(LEADS_INDEX_KEY, record.leadId);
    } catch (err) {
      // Still forward to the sheet below — Redis being down shouldn't lose the lead entirely.
      console.error(`[agency-health-check] Redis write failed for lead ${record.leadId}:`, err);
    }
  }

  const identity = { email: record.contact.email, phone: record.contact.phone, intent: record.intent };
  const duplicate = await isDuplicateSubmission(identity, client);
  if (duplicate) {
    console.warn(`[agency-health-check] lead ${record.leadId} repeats a submission from the last few minutes — stored, not forwarded.`);
    return { duplicate: true };
  }

  const { undelivered } = await forwardToWebhook(record);
  if (undelivered) {
    // Nothing downstream took the lead, for a reason a retry could fix (not
    // "webhook unconfigured"): shorten the reservation so the next attempt
    // isn't hidden for the full window.
    await shortenDuplicateReservation(identity, client);
  }
  return { duplicate: false };
}

export async function getLeadById(leadId: string): Promise<LeadRecord | undefined> {
  const client = redis();
  if (!client) return undefined;
  const record = await client.get<LeadRecord>(leadKey(leadId));
  return record ?? undefined;
}

/** Every captured lead, oldest first — powers the admin export route. */
export async function getAllLeads(): Promise<LeadRecord[]> {
  const client = redis();
  if (!client) return [];
  const ids = await client.lrange<string>(LEADS_INDEX_KEY, 0, -1);
  if (ids.length === 0) return [];
  const records = await Promise.all(ids.map((id) => client.get<LeadRecord>(leadKey(id))));
  return records.filter((r): r is LeadRecord => r !== null);
}
