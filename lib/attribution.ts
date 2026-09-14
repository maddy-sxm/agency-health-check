/**
 * Marketing attribution for the lead record — UTM parameters, ad click ids,
 * referrer, and landing URL.
 *
 * The tool is a single page, so within one visit the values read on first
 * load survive every screen, the submit, and "Retake". What they did NOT
 * survive was a *return visit*: someone who lands from an ad, leaves, and
 * comes back later by typing the domain used to be recorded with no
 * attribution at all. So the resolved attribution is persisted in
 * localStorage for ATTRIBUTION_TTL_DAYS and reused whenever a later visit
 * arrives without campaign parameters of its own.
 *
 * Precedence, per visit:
 *   1. Campaign params in the current URL (utm_* or a click id) always win,
 *      and overwrite whatever was stored — the freshest tagged visit is the
 *      one a later untagged visit should resolve to.
 *   2. Otherwise, the stored attribution from an earlier tagged visit.
 *   3. Otherwise, just this visit's referrer + landing URL (organic/direct).
 *
 * Pure function + injectable storage so it's unit-testable without a DOM.
 */

import type { UtmParams } from "./types";

export const ATTRIBUTION_STORAGE_KEY = "ahc_attribution_v1";
export const ATTRIBUTION_TTL_DAYS = 30;

/** Query-string keys that identify a paid/tagged visit. */
export const CAMPAIGN_PARAM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid", // Google Ads click id
  "fbclid", // Meta click id
  "li_fat_id", // LinkedIn click id
] as const;

type CampaignParamKey = (typeof CAMPAIGN_PARAM_KEYS)[number];

const MAX_PARAM_LENGTH = 512;

interface StoredAttribution {
  params: UtmParams;
  savedAt: string; // ISO
}

export interface AttributionInput {
  /** Current URL's query string (URLSearchParams or anything with .get). */
  searchParams: { get(name: string): string | null };
  /** document.referrer at first load ("" when none). */
  referrer: string;
  /** window.location.href at first load. */
  landingUrl: string;
  /** localStorage-like; pass null when unavailable (SSR, privacy mode). */
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  /** Injectable clock for tests. */
  now?: () => Date;
}

function campaignParamsFromUrl(searchParams: AttributionInput["searchParams"]): Partial<Record<CampaignParamKey, string>> {
  const out: Partial<Record<CampaignParamKey, string>> = {};
  for (const key of CAMPAIGN_PARAM_KEYS) {
    const raw = searchParams.get(key);
    if (raw && raw.trim()) out[key] = raw.trim().slice(0, MAX_PARAM_LENGTH);
  }
  return out;
}

/** The referrer is only meaningful when it's another site — our own pages
 *  (a reload, or a link from another route) tell us nothing about the source. */
function externalReferrer(referrer: string, landingUrl: string): string | undefined {
  if (!referrer) return undefined;
  try {
    return new URL(referrer).host === new URL(landingUrl).host ? undefined : referrer;
  } catch {
    return referrer || undefined;
  }
}

function readStored(storage: AttributionInput["storage"], now: Date): UtmParams | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAttribution>;
    const savedAt = parsed.savedAt ? new Date(parsed.savedAt).getTime() : NaN;
    const ageMs = now.getTime() - savedAt;
    if (!parsed.params || Number.isNaN(savedAt) || ageMs < 0 || ageMs > ATTRIBUTION_TTL_DAYS * 86_400_000) {
      storage.removeItem(ATTRIBUTION_STORAGE_KEY);
      return null;
    }
    return parsed.params;
  } catch {
    return null;
  }
}

function writeStored(storage: AttributionInput["storage"], params: UtmParams, now: Date): void {
  if (!storage) return;
  try {
    const record: StoredAttribution = { params, savedAt: now.toISOString() };
    storage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage full / blocked — attribution simply isn't remembered across visits.
  }
}

/** Resolve what to attribute this visit to, persisting tagged visits. */
export function resolveAttribution(input: AttributionInput): UtmParams {
  const now = input.now ? input.now() : new Date();
  const fromUrl = campaignParamsFromUrl(input.searchParams);
  const referrer = externalReferrer(input.referrer, input.landingUrl);

  if (Object.keys(fromUrl).length > 0) {
    const resolved: UtmParams = { ...fromUrl, landingUrl: input.landingUrl };
    if (referrer) resolved.referrer = referrer;
    writeStored(input.storage, resolved, now);
    return resolved;
  }

  const stored = readStored(input.storage, now);
  if (stored) {
    // Keep the campaign that originally brought them (and its landing URL);
    // only refresh the referrer if this visit has a meaningful external one.
    return referrer ? { ...stored, referrer } : stored;
  }

  const organic: UtmParams = { landingUrl: input.landingUrl };
  if (referrer) organic.referrer = referrer;
  return organic;
}

/** Browser convenience: reads location/referrer/localStorage itself. */
export function resolveBrowserAttribution(searchParams: AttributionInput["searchParams"]): UtmParams {
  if (typeof window === "undefined") return {};
  let storage: AttributionInput["storage"] = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  return resolveAttribution({
    searchParams,
    referrer: typeof document !== "undefined" ? document.referrer : "",
    landingUrl: window.location.href,
    storage,
  });
}
