import assert from "node:assert/strict";
import { test } from "node:test";
import { DEDUPE_WINDOW_SECONDS, duplicateKey, isDuplicateSubmission, releaseDuplicateReservation } from "../lib/dedupe";

const base = { email: "Jane@Acme.com ", phone: "(555) 010-2026", intent: "call" as const };

test("duplicate key normalises email case/whitespace and phone digits, and contains no PII", () => {
  const key = duplicateKey(base);
  assert.match(key, /^agency-health-check:dedupe:[0-9a-f]{64}$/);
  assert.ok(!key.includes("acme") && !key.includes("5550102026"));
  assert.equal(duplicateKey({ ...base, email: "jane@acme.com", phone: "555-010-2026" }), key);
});

test("the two CTAs are tracked separately", () => {
  assert.notEqual(duplicateKey(base), duplicateKey({ ...base, intent: "report" }));
});

test("first submission is not a duplicate, an identical repeat within the window is", async () => {
  const store = new Map<string, number>();
  const client = {
    set: async (key: string, _v: string, opts: { nx: true; ex: number }) => {
      if (store.has(key)) return null;
      store.set(key, opts.ex);
      return "OK";
    },
    del: async (key: string) => (store.delete(key) ? 1 : 0),
  };
  assert.equal(await isDuplicateSubmission(base, client), false);
  assert.equal(await isDuplicateSubmission(base, client), true);
  assert.equal(await isDuplicateSubmission({ ...base, intent: "report" }, client), false);
  assert.equal(store.get(duplicateKey(base)), DEDUPE_WINDOW_SECONDS);
  assert.equal(DEDUPE_WINDOW_SECONDS, 5 * 60, "short window");
  // releasing the reservation (delivery failed) lets the next attempt through
  await releaseDuplicateReservation(base, client);
  assert.equal(await isDuplicateSubmission(base, client), false);
});

test("without Redis nothing is ever treated as a duplicate", async () => {
  assert.equal(await isDuplicateSubmission(base, null), false);
});

test("a Redis error fails open (not a duplicate)", async () => {
  const client = { set: async () => { throw new Error("down"); }, del: async () => { throw new Error("down"); } };
  assert.equal(await isDuplicateSubmission(base, client), false);
  await releaseDuplicateReservation(base, client); // must not throw
});
