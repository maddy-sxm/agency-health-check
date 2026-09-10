/**
 * Meta (Facebook) Pixel integration.
 *
 * Fill in PIXEL_ID once SPEEDX's ad account is ready — everything else here
 * is already wired up. Until then, calls are safe no-ops.
 */

// TODO: fill in with the real Meta Pixel ID, e.g. "1234567890123456"
export const PIXEL_ID = "";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** Meta's own standard event names — https://developers.facebook.com/docs/meta-pixel/reference */
export type MetaStandardEvent = "Lead" | "Schedule" | "Contact" | "ViewContent" | "Share";

export function trackStandardEvent(event: MetaStandardEvent, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", event, params);
}

/** Path-tagged custom events, e.g. "AgencyHealthCheck_QuestionAnswered". */
export function trackCustomEvent(event: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("trackCustom", event, params);
}
