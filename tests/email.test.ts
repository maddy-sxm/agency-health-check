import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMailgunRequest, parseRecipientList, resolveMailgunConfig } from "../lib/mailgun";
import { buildLeadNotification, buildReportEmailBody } from "../lib/email";
import { computePublicResult } from "../lib/scoring";
import type { LeadRecord } from "../lib/types";

const record: LeadRecord = {
  leadId: "lead-123",
  contact: { name: "Jane Doe", email: "jane@acme.com", phone: "(555) 010-2026", role: "cmo" },
  services: ["paid-media", "seo"],
  diagnosticAnswers: { contact: "rotates", responsiveness: "three-five-days", turnover: "once", proactivity: "we-lead-most", strategyDoc: "mostly-ad-hoc", perfAccountability: "probably-not", renewal: "anxious", dataOwnership: "mostly" },
  qualificationAnswers: {},
  publicResult: computePublicResult({ contact: "rotates", responsiveness: "three-five-days", turnover: "once", proactivity: "we-lead-most", strategyDoc: "mostly-ad-hoc", perfAccountability: "probably-not", renewal: "anxious", dataOwnership: "mostly" }),
  internalLeadScore: 82,
  internalClassification: "Tier 1: High Priority",
  internalScoreBasis: ["role", "agencyPain"],
  intent: "call",
  utm: { utm_source: "linkedin", utm_campaign: "q4", landingUrl: "https://agency-health-check.speedxmedia.com/?utm_source=linkedin" },
  source: "agency-health-check",
  createdAt: "2026-10-05T15:00:00.000Z",
};

test("recipient list parsing: comma/semicolon/newline separated, trimmed, deduped, invalid dropped", () => {
  assert.deepEqual(parseRecipientList("spencer@speedxmedia.com, Juan@speedxmedia.com ;\n spencer@speedxmedia.com, not-an-email, "), [
    "spencer@speedxmedia.com",
    "juan@speedxmedia.com",
  ]);
  assert.deepEqual(parseRecipientList(undefined), []);
});

test("mailgun config: unset -> null; us/eu regions pick the right host", () => {
  assert.equal(resolveMailgunConfig({}), null);
  assert.equal(resolveMailgunConfig({ MAILGUN_API_KEY: "k" }), null, "domain required");
  const us = resolveMailgunConfig({ MAILGUN_API_KEY: "k", MAILGUN_DOMAIN: "mg.speedxmedia.com", MAIL_FROM: "Agency Health Check <noreply@mg.speedxmedia.com>" })!;
  assert.equal(us.endpoint, "https://api.mailgun.net/v3/mg.speedxmedia.com/messages");
  const eu = resolveMailgunConfig({ MAILGUN_API_KEY: "k", MAILGUN_DOMAIN: "mg.speedxmedia.com", MAILGUN_REGION: "eu" })!;
  assert.equal(eu.endpoint, "https://api.eu.mailgun.net/v3/mg.speedxmedia.com/messages");
  assert.equal(eu.from, "Agency Health Check <postmaster@mg.speedxmedia.com>", "default from");
});

test("mailgun request: basic auth + form fields, multiple recipients, reply-to", () => {
  const cfg = resolveMailgunConfig({ MAILGUN_API_KEY: "key-abc", MAILGUN_DOMAIN: "mg.speedxmedia.com" })!;
  const req = buildMailgunRequest(cfg, { to: ["a@x.com", "b@x.com"], subject: "Hi", text: "body", html: "<p>body</p>", replyTo: "jane@acme.com" });
  assert.equal(req.headers.Authorization, "Basic " + Buffer.from("api:key-abc").toString("base64"));
  const body = new URLSearchParams(req.body);
  assert.deepEqual(body.getAll("to"), ["a@x.com", "b@x.com"]);
  assert.equal(body.get("subject"), "Hi");
  assert.equal(body.get("text"), "body");
  assert.equal(body.get("html"), "<p>body</p>");
  assert.equal(body.get("h:Reply-To"), "jane@acme.com");
  assert.equal(body.get("from"), cfg.from);
});

test("lead notification: subject + key fields + reply-to the respondent", () => {
  const n = buildLeadNotification(record);
  assert.equal(n.subject, "New lead: Jane Doe (CMO / Chief Growth Officer / Marketing Executive) — Tier 1: High Priority · Strategy Call");
  assert.equal(n.replyTo, "jane@acme.com");
  for (const needle of ["Jane Doe", "jane@acme.com", "(555) 010-2026", "CMO / Chief Growth Officer / Marketing Executive", "Paid Media, SEO", "42", "The Black Box", "82", "Tier 1: High Priority", "Strategy Call", "linkedin", "q4", "lead-123"]) {
    assert.ok(n.text.includes(needle), "text missing " + needle);
    assert.ok(n.html.includes(needle.replace(/&/g, "&amp;")), "html missing " + needle);
  }
  assert.ok(n.text.includes("Where It Breaks Down"), "includes the diagnostic breakdown");
  assert.ok(n.html.includes("docs.google.com/spreadsheets/d/1OJRt-0Ua6n_9OrGa9R-TlSp4KofjDi4QndZJJZm2X88"), "links the sheet");
});

test("lead notification html carries the app's dark palette and pillar bars", () => {
  const n = buildLeadNotification(record);
  assert.ok(n.html.includes("#d9573b"), "coral accent");
  assert.ok(n.html.includes("background:#000000"), "ink ground");
  assert.ok(n.html.includes("speedxmedia-logo.png"), "logo");
  assert.ok(n.html.includes("Communication &amp; Access"), "pillar labels");
  assert.ok(n.html.includes("mailto:jane@acme.com"), "reply button");
  assert.ok(n.html.includes("<!DOCTYPE html>"));
});

test("lead notification escapes HTML in respondent-supplied fields", () => {
  const n = buildLeadNotification({ ...record, contact: { ...record.contact, name: "<script>x</script> & co" } });
  assert.ok(!n.html.includes("<script>"));
  assert.ok(n.html.includes("&lt;script&gt;x&lt;/script&gt; &amp; co"));
});

test("report email body still renders the full report", () => {
  const body = buildReportEmailBody(record);
  assert.ok(body.startsWith("Agency Health Score: 42 / 100 — The Black Box"));
  assert.ok(body.includes("Prepared for Jane Doe"));
});
