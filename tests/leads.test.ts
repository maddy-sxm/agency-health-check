import assert from "node:assert/strict";
import { test } from "node:test";
import { leadWentUndelivered } from "../lib/leads";

const sheet = (ok: boolean, configured = true) => ({ ok, configured });

test("duplicate-guard reservation is only shortened when nothing downstream took the lead and a retry could help", () => {
  // Either destination taking the lead is enough: the guard stays at full length.
  assert.equal(leadWentUndelivered(sheet(true), "delivered"), false);
  assert.equal(leadWentUndelivered(sheet(true), "failed"), false, "CRM down, Sheet has it");
  assert.equal(leadWentUndelivered(sheet(true), "rejected"), false);
  assert.equal(leadWentUndelivered(sheet(true), "unconfigured"), false);
  assert.equal(leadWentUndelivered(sheet(false), "delivered"), false, "Sheet down, CRM has it");

  // Nothing took it, and trying again could work.
  assert.equal(leadWentUndelivered(sheet(false), "failed"), true);
  assert.equal(leadWentUndelivered(sheet(false), "unconfigured"), true, "the pre-CRM behaviour");
  assert.equal(leadWentUndelivered(sheet(false), "rejected"), true, "the Sheet failure is retryable even if the CRM is misconfigured");
  assert.equal(leadWentUndelivered(sheet(false, false), "failed"), true, "CRM is the only destination and had a transient failure");

  // Nothing took it, but a retry cannot help: never loosen the guard.
  assert.equal(leadWentUndelivered(sheet(false, false), "rejected"), false, "CRM misconfigured (4xx)");
  assert.equal(leadWentUndelivered(sheet(false, false), "unconfigured"), false, "nothing configured (local dev)");
});
