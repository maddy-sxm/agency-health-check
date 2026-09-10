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
 * SWAPPING IN A REAL CRM / WEBHOOK (Zapier, HubSpot, Google Sheets, etc.)
 * ============================================================================
 * There is exactly ONE integration point to change: `forwardToWebhook()`
 * below. It is called every time a lead is saved, right after the Redis
 * write. Replace the no-op body with a `fetch()` POST to your Zapier/
 * HubSpot/Sheets webhook URL. Nothing else in the app needs to change.
 * ============================================================================
 */

import { Redis } from "@upstash/redis";
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
 * THE single integration point for a future CRM/webhook swap.
 * Replace with e.g.:
 *   await fetch(process.env.LEAD_WEBHOOK_URL!, {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({ type: "lead", record }),
 *   });
 */
async function forwardToWebhook(record: LeadRecord): Promise<void> {
  // No-op for now — leads live only in Redis until this is wired up.
  void record;
}

export async function saveLead(record: LeadRecord): Promise<void> {
  const client = redis();
  if (!client) {
    console.warn(
      `[agency-health-check] KV_REST_API_URL / KV_REST_API_TOKEN not set — lead ${record.leadId} was NOT persisted. ` +
        "This is expected in local dev without Upstash credentials; it must be fixed before production launch."
    );
    return;
  }
  await client.set(leadKey(record.leadId), record);
  await client.rpush(LEADS_INDEX_KEY, record.leadId);
  await forwardToWebhook(record);
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
