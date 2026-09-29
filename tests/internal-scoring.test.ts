import assert from "node:assert/strict";
import { test } from "node:test";
import { computeInternalLeadScore } from "../lib/internal-scoring";

const FULL = { revenue: "10m-25m", marketingSpend: "50k-100k", agencySpend: "25k-50k", renewalTiming: "one-three-months" } as const;

test("all inputs present: unchanged from the approved formula", () => {
  // revenue 55*.20 + budget (70*.4 + 75*.6 = 73)*.30 + role 100*.20 + renewal 90*.15 + pain 50*.15
  // = 11 + 21.9 + 20 + 13.5 + 7.5 = 73.9 -> 74
  const r = computeInternalLeadScore({ qualification: FULL, role: "cmo", agencyHealthScore: 50 });
  assert.equal(r.score, 74);
  assert.equal(r.classification, "Tier 2: Qualified");
  assert.deepEqual(r.basis, ["revenue", "budget", "role", "renewal", "agencyPain"]);
});

test("no qualification answers: re-normalised over role + agency pain", () => {
  // (role 100*.20 + pain 58*.15) / .35 = 28.7 / .35 = 82
  const ceo = computeInternalLeadScore({ qualification: {}, role: "ceo-founder", agencyHealthScore: 42 });
  assert.equal(ceo.score, 82);
  assert.equal(ceo.classification, "Tier 1: High Priority");
  assert.deepEqual(ceo.basis, ["role", "agencyPain"]);
});

test("without qualification data the tiers still spread across all four bands", () => {
  const score = (role: Parameters<typeof computeInternalLeadScore>[0]["role"], health: number) =>
    computeInternalLeadScore({ qualification: {}, role, agencyHealthScore: health });
  assert.equal(score("ceo-founder", 20).classification, "Tier 1: High Priority"); // (20 + 12) / .35 = 91
  assert.equal(score("director", 42).classification, "Tier 2: Qualified"); // (14 + 8.7) / .35 = 65
  assert.equal(score("manager", 42).classification, "Tier 3: Nurture"); // (8 + 8.7) / .35 = 48
  assert.equal(score("other", 80).classification, "Tier 4: Low Fit"); // (4 + 3) / .35 = 20
});

test("score stays within 0-100 at the extremes", () => {
  assert.equal(computeInternalLeadScore({ qualification: {}, role: "ceo-founder", agencyHealthScore: 0 }).score, 100);
  assert.equal(computeInternalLeadScore({ qualification: {}, role: "other", agencyHealthScore: 100 }).score, 11);
});

test("an answered 0-point option counts as data, not as missing", () => {
  // revenue answered "under-2m" (0 pts) stays in the denominator:
  // (0*.20 + role 100*.20 + pain 50*.15) / .55 = 27.5 / .55 = 50
  const r = computeInternalLeadScore({ qualification: { revenue: "under-2m" }, role: "cmo", agencyHealthScore: 50 });
  assert.equal(r.score, 50);
  assert.deepEqual(r.basis, ["revenue", "role", "agencyPain"]);
});

test("partial budget: the one spend answer given carries the whole budget component", () => {
  // budget = agencySpend 75 only; (75*.30 + 100*.20 + 50*.15) / .65 = 50 / .65 = 76.9 -> 77
  const r = computeInternalLeadScore({ qualification: { agencySpend: "25k-50k" }, role: "cmo", agencyHealthScore: 50 });
  assert.equal(r.score, 77);
  assert.deepEqual(r.basis, ["budget", "role", "agencyPain"]);
});

test("unknown option ids are treated as unanswered", () => {
  const r = computeInternalLeadScore({ qualification: { revenue: "not-a-real-option" }, role: "cmo", agencyHealthScore: 50 });
  assert.deepEqual(r.basis, ["role", "agencyPain"]);
});
