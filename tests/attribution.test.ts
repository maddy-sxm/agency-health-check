import assert from "node:assert/strict";
import { test } from "node:test";
import { ATTRIBUTION_STORAGE_KEY, resolveAttribution } from "../lib/attribution";

const mem = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};
const sp = (q: string) => new URLSearchParams(q);
const SITE = "https://agency-health-check.speedxmedia.com/";
const at = (offsetDays: number) => () => new Date(Date.UTC(2026, 8, 14) + offsetDays * 86_400_000);
const TAGGED = SITE + "?utm_source=linkedin&utm_campaign=q3&li_fat_id=abc";

test("tagged visit: URL params win, external referrer kept, persisted", () => {
  const s = mem();
  const r = resolveAttribution({ searchParams: sp("utm_source=linkedin&utm_campaign=q3&li_fat_id=abc&gclid=&junk=1"), referrer: "https://www.linkedin.com/feed/", landingUrl: TAGGED, storage: s, now: at(0) });
  assert.deepEqual(r, { utm_source: "linkedin", utm_campaign: "q3", li_fat_id: "abc", landingUrl: TAGGED, referrer: "https://www.linkedin.com/feed/" });
  assert.ok(s.getItem(ATTRIBUTION_STORAGE_KEY));
});

test("untagged return visit reuses the stored campaign; a new referrer refreshes only the referrer", () => {
  const s = mem();
  const first = resolveAttribution({ searchParams: sp("utm_source=linkedin&utm_campaign=q3&li_fat_id=abc"), referrer: "https://www.linkedin.com/feed/", landingUrl: TAGGED, storage: s, now: at(0) });
  assert.deepEqual(resolveAttribution({ searchParams: sp(""), referrer: "", landingUrl: SITE, storage: s, now: at(10) }), first);
  assert.deepEqual(resolveAttribution({ searchParams: sp(""), referrer: "https://www.google.com/", landingUrl: SITE, storage: s, now: at(11) }), { ...first, referrer: "https://www.google.com/" });
});

test("a newer tagged visit overwrites the stored one", () => {
  const s = mem();
  resolveAttribution({ searchParams: sp("utm_source=linkedin"), referrer: "", landingUrl: SITE + "?utm_source=linkedin", storage: s, now: at(0) });
  const fresh = resolveAttribution({ searchParams: sp("utm_source=meta&fbclid=xyz"), referrer: "", landingUrl: SITE + "?utm_source=meta&fbclid=xyz", storage: s, now: at(2) });
  assert.deepEqual(fresh, { utm_source: "meta", fbclid: "xyz", landingUrl: SITE + "?utm_source=meta&fbclid=xyz" });
  assert.deepEqual(resolveAttribution({ searchParams: sp(""), referrer: "", landingUrl: SITE, storage: s, now: at(3) }), fresh);
});

test("stored attribution expires after 30 days and is cleared", () => {
  const s = mem();
  resolveAttribution({ searchParams: sp("utm_source=linkedin"), referrer: "", landingUrl: SITE, storage: s, now: at(0) });
  assert.deepEqual(resolveAttribution({ searchParams: sp(""), referrer: "", landingUrl: SITE, storage: s, now: at(31) }), { landingUrl: SITE });
  assert.equal(s.getItem(ATTRIBUTION_STORAGE_KEY), null);
});

test("organic visit: external referrer only, same-site referrer ignored, nothing stored", () => {
  const s = mem();
  assert.deepEqual(resolveAttribution({ searchParams: sp(""), referrer: "https://www.bing.com/", landingUrl: SITE, storage: s, now: at(0) }), { landingUrl: SITE, referrer: "https://www.bing.com/" });
  assert.deepEqual(resolveAttribution({ searchParams: sp(""), referrer: SITE, landingUrl: SITE, storage: s, now: at(0) }), { landingUrl: SITE });
  assert.equal(s.getItem(ATTRIBUTION_STORAGE_KEY), null);
});

test("missing or corrupt storage never throws", () => {
  assert.deepEqual(resolveAttribution({ searchParams: sp("utm_source=x"), referrer: "", landingUrl: SITE, storage: null }), { utm_source: "x", landingUrl: SITE });
  const s = mem();
  s.setItem(ATTRIBUTION_STORAGE_KEY, "{not json");
  assert.deepEqual(resolveAttribution({ searchParams: sp(""), referrer: "", landingUrl: SITE, storage: s }), { landingUrl: SITE });
});

test("oversized values are truncated", () => {
  const r = resolveAttribution({ searchParams: sp("gclid=" + "a".repeat(2000)), referrer: "", landingUrl: SITE, storage: null });
  assert.equal(r.gclid?.length, 512);
});
