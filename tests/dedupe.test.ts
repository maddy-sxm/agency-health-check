import assert from "node:assert/strict";
import { test } from "node:test";
import { DEDUPE_WINDOW_SECONDS, RETRY_GRACE_SECONDS, duplicateKey, isDuplicateSubmission, shortenDuplicateReservation } from "../lib/dedupe";

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
    expire: async (key: string, seconds: number) => { if (!store.has(key)) return 0; store.set(key, seconds); return 1; },
  };
  assert.equal(await isDuplicateSubmission(base, client), false);
  assert.equal(await isDuplicateSubmission(base, client), true);
  assert.equal(await isDuplicateSubmission({ ...base, intent: "report" }, client), false);
  assert.equal(store.get(duplicateKey(base)), DEDUPE_WINDOW_SECONDS);
  assert.equal(DEDUPE_WINDOW_SECONDS, 5 * 60, "short window");
  // a failed delivery shortens the reservation rather than deleting it
  await shortenDuplicateReservation(base, client);
  assert.equal(store.get(duplicateKey(base)), RETRY_GRACE_SECONDS);
  assert.equal(await isDuplicateSubmission(base, client), true, "still reserved until the grace period lapses");
});

test("without Redis nothing is ever treated as a duplicate", async () => {
  assert.equal(await isDuplicateSubmission(base, null), false);
});

test("a Redis error fails open (not a duplicate)", async () => {
  const client = { set: async () => { throw new Error("down"); }, expire: async () => { throw new Error("down"); } };
  assert.equal(await isDuplicateSubmission(base, client), false);
  await shortenDuplicateReservation(base, client); // must not throw
});
