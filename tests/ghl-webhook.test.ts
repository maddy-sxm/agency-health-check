import assert from "node:assert/strict";
import { test } from "node:test";
import { GHL_TOOL_TAG, buildGhlLeadPayload, buildGhlNote, describeFetchError, forwardLeadToGhl, ghlWebhookUrl, normalizePhone, tidyName } from "../lib/ghl-webhook";
import { computePublicResult } from "../lib/scoring";
import type { DiagnosticAnswers, LeadRecord } from "../lib/types";

const answers: DiagnosticAnswers = {
  contact: "rotates",
  responsiveness: "three-five-days",
  turnover: "once",
  proactivity: "we-lead-most",
  strategyDoc: "mostly-ad-hoc",
  perfAccountability: "probably-not",
  renewal: "anxious",
  dataOwnership: "mostly",
};

const record: LeadRecord = {
  leadId: "lead-123",
  contact: { name: "jane doe", email: " Jane@Acme.com ", phone: "(555) 010-2026", role: "cmo" },
  services: ["paid-media", "seo"],
  diagnosticAnswers: answers,
  qualificationAnswers: {},
  publicResult: computePublicResult(answers),
  internalLeadScore: 82,
  internalClassification: "Tier 1: High Priority",
  internalScoreBasis: ["role", "agencyPain"],
  intent: "call",
  utm: {
    utm_source: "linkedin",
    utm_medium: "paid_social",
    utm_campaign: "q4",
    utm_term: "cmo",
    utm_content: "video-a",
    li_fat_id: "li-1",
    referrer: "https://www.linkedin.com/",
    landingUrl: "https://agency-health-check.speedxmedia.com/?utm_source=linkedin",
  },
  source: "agency-health-check",
  createdAt: "2026-10-05T15:00:00.000Z",
};

const URL = "https://services.leadconnectorhq.com/hooks/LOC/webhook-trigger/abc";
const ok = () => new Response('{"status":"Success"}', { status: 200 });

function silenced<T>(fn: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => {};
  return fn().finally(() => {
    console.error = original;
  });
}

test("phone: US numbers become E.164, international and odd numbers pass through", () => {
  assert.equal(normalizePhone("(555) 010-2026"), "+15550102026");
  assert.equal(normalizePhone("14097486613"), "+14097486613");
  assert.equal(normalizePhone("+44 20 7946 0958"), "+442079460958");
  assert.equal(normalizePhone(" 32965455 "), "32965455", "8 digits: not guessed at");
});

test("name: single-case names are capitalised, mixed case is left as typed", () => {
  assert.equal(tidyName("  ahmad   malik "), "Ahmad Malik");
  assert.equal(tidyName("JANE O'NEIL-SMITH"), "Jane O'Neil-Smith");
  assert.equal(tidyName("Ronald McDonald"), "Ronald McDonald");
  assert.equal(tidyName("María de la Cruz"), "María de la Cruz");
  assert.equal(tidyName("eng"), "Eng");
});

test("payload: contact, attribution and CRM fields for a live strategy-call lead", () => {
  const p = buildGhlLeadPayload(record);
  assert.equal(p.mode, "live");
  assert.equal(p.first_name, "Jane");
  assert.equal(p.last_name, "Doe");
  assert.equal(p.full_name, "Jane Doe");
  assert.equal(p.email, "jane@acme.com");
  assert.equal(p.phone, "+15550102026");
  assert.equal(p.job_title, "CMO / Chief Growth Officer / Marketing Executive");
  assert.equal(p.lead_source, "linkedin");
  assert.equal(p.source_url, "https://agency-health-check.speedxmedia.com/?utm_source=linkedin");
  assert.deepEqual([p.utm_source, p.utm_medium, p.utm_campaign, p.utm_term, p.utm_content], ["linkedin", "paid_social", "q4", "cmo", "video-a"]);
  assert.equal(p.li_fat_id, "li-1");
  assert.equal(p.tags, `${GHL_TOOL_TAG}, ahc: strategy call, ahc: tier 1`);
  assert.equal(p.opportunity_name, "Jane Doe - Agency Health Check (Tier 1: High Priority)");
  assert.equal(p.note_title, "Agency Health Check: The Black Box · Tier 1: High Priority");
  assert.equal(p.agency_score, "42");
  assert.equal(p.lead_score, "82");
  assert.equal(p.services, "Paid Media, SEO");
  assert.equal(p.submission_id, "lead-123");
  for (const [key, value] of Object.entries(p)) assert.equal(typeof value, "string", `${key} must be a string for the workflow mapping`);
});

test("payload: report intent, no campaign -> 'direct', single-word name, backfill mode", () => {
  const p = buildGhlLeadPayload(
    { ...record, intent: "report", contact: { ...record.contact, name: "Heather" }, utm: {}, internalClassification: "Tier 4: Low Fit" },
    "backfill"
  );
  assert.equal(p.mode, "backfill");
  assert.equal(p.first_name, "Heather");
  assert.equal(p.last_name, "");
  assert.equal(p.lead_source, "direct");
  assert.equal(p.source_url, "");
  assert.equal(p.tags, `${GHL_TOOL_TAG}, ahc: report, ahc: tier 4`);
  assert.equal(p.cta_action, "Full report requested");
});

test("note: the lines sales already reads, then the full diagnostic, answers and source", () => {
  const note = buildGhlNote(record);
  for (const needle of [
    "Lead Tier: Tier 1: High Priority",
    "Internal Lead Score: 82 / 100",
    "Agency Score (shown to them): 42 / 100",
    "Result/Archetype: The Black Box",
    "Lowest Scoring Pillar: ",
    "Services Selected: Paid Media, SEO",
    "CTA Action: Strategy call requested",
    "Role: CMO / Chief Growth Officer / Marketing Executive",
    "PILLARS",
    "THEIR ANSWERS",
    "Rotates by project",
    "Campaign: linkedin / paid_social / q4",
    "Landing page: https://agency-health-check.speedxmedia.com/?utm_source=linkedin",
    "Submitted: Oct 5, 2026, 8:00 AM PDT",
    "Submission ID: lead-123",
  ]) {
    assert.ok(note.includes(needle), "note missing: " + needle);
  }
  assert.ok(!note.includes("undefined") && !note.includes("null"), "no stray undefined/null");
  assert.ok(buildGhlNote({ ...record, utm: {} }).includes("Campaign: direct / organic"));
});

test("url: unset, blank or non-https means not configured", () => {
  assert.equal(ghlWebhookUrl({}), null);
  assert.equal(ghlWebhookUrl({ GHL_WEBHOOK_URL: "  " }), null);
  assert.equal(ghlWebhookUrl({ GHL_WEBHOOK_URL: "http://insecure.example/hook" }), null);
  assert.equal(ghlWebhookUrl({ GHL_WEBHOOK_URL: ` ${URL} ` }), URL);
});

test("forward: not configured -> 'unconfigured', nothing sent", async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return ok();
  }) as typeof fetch;
  assert.equal(await forwardLeadToGhl(record, { url: null, fetchImpl }), "unconfigured");
  assert.equal(calls, 0);
});

test("forward: POSTs the JSON payload once and resolves 'delivered' on 200", async () => {
  const seen: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    return ok();
  }) as unknown as typeof fetch;
  assert.equal(await forwardLeadToGhl(record, { url: URL, fetchImpl }), "delivered");
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, URL);
  assert.equal(seen[0].init.method, "POST");
  assert.equal((seen[0].init.headers as Record<string, string>)["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(seen[0].init.body as string), buildGhlLeadPayload(record));
});

test("forward: a 5xx or a network error is retried once; success on the retry counts", async () => {
  let calls = 0;
  const flaky = (async () => {
    calls++;
    if (calls === 1) return new Response("upstream", { status: 502 });
    return ok();
  }) as typeof fetch;
  assert.equal(await silenced(() => forwardLeadToGhl(record, { url: URL, fetchImpl: flaky, retryDelayMs: 0 })), "delivered");
  assert.equal(calls, 2);

  calls = 0;
  const down = (async () => {
    calls++;
    throw new Error("ECONNRESET");
  }) as typeof fetch;
  assert.equal(await silenced(() => forwardLeadToGhl(record, { url: URL, fetchImpl: down, retryDelayMs: 0 })), "failed");
  assert.equal(calls, 2, "two attempts, then give up — never throws");
});

test("forward: a 4xx is a configuration error — 'rejected', not retried", async () => {
  let calls = 0;
  const rejected = (async () => {
    calls++;
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  assert.equal(await silenced(() => forwardLeadToGhl(record, { url: URL, fetchImpl: rejected, retryDelayMs: 0 })), "rejected");
  assert.equal(calls, 1);
});

test("logs: never the webhook URL, the payload or the upstream response body", async () => {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => lines.push(args.map(String).join(" "));
  try {
    const leaky = (async () => new Response(`echo ${record.contact.email} ${URL}`, { status: 500 })) as typeof fetch;
    await forwardLeadToGhl(record, { url: URL, fetchImpl: leaky, retryDelayMs: 0 });
    const badUrl = (async () => {
      throw new TypeError(`Failed to parse URL from ${URL}`);
    }) as typeof fetch;
    await forwardLeadToGhl(record, { url: URL, fetchImpl: badUrl, retryDelayMs: 0 });
  } finally {
    console.error = original;
  }
  assert.equal(lines.length, 4, "two attempts each");
  for (const line of lines) {
    assert.ok(!line.includes(URL) && !line.includes("webhook-trigger"), "webhook URL leaked: " + line);
    assert.ok(!line.toLowerCase().includes("jane@acme.com"), "PII leaked: " + line);
    assert.ok(line.includes("lead-123"), "keeps the lead id for correlation");
  }
  assert.equal(describeFetchError(new TypeError(`Failed to parse URL from ${URL}`), URL), "TypeError: Failed to parse URL from [webhook url]");
  assert.equal(describeFetchError(Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } }), URL), "TypeError: fetch failed (ECONNRESET)");
});
