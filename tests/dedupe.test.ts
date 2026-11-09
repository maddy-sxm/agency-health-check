import assert from "node:assert/strict";
import { test } from "node:test";
import { duplicateKey, isDuplicateSubmission } from "../lib/dedupe";

const base = { email: "Jane@Acme.com ", phone: "(555) 010-2026", intent: "call" as const };

test("duplicate key normalises email case/whitespace and phone digits", () => {
  assert.equal(duplicateKey(base), "agency-health-check:dedupe:jane@acme.com:5550102026:call");
  assert.equal(duplicateKey({ ...base, email: "jane@acme.com", phone: "555-010-2026" }), duplicateKey(base));
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
  };
  assert.equal(await isDuplicateSubmission(base, client), false);
  assert.equal(await isDuplicateSubmission(base, client), true);
  assert.equal(await isDuplicateSubmission({ ...base, intent: "report" }, client), false);
  assert.equal(store.get(duplicateKey(base)), 15 * 60, "15-minute window");
});

test("without Redis nothing is ever treated as a duplicate", async () => {
  assert.equal(await isDuplicateSubmission(base, null), false);
});

test("a Redis error fails open (not a duplicate)", async () => {
  const client = { set: async () => { throw new Error("down"); } };
  assert.equal(await isDuplicateSubmission(base, client), false);
});
