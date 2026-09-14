/**
 * Meta (Facebook) Pixel integration.
 *
 * Same Pixel as speedxmedia.com. The base code is rendered once by
 * components/MetaPixel.tsx (in app/layout.tsx); the helpers below are safe
 * no-ops until fbevents.js has loaded, so they can be called from anywhere
 * in client code without guarding.
 */

export const PIXEL_ID = "2351628112024068";

/** Which lead-form CTA converted — reported to Meta as `content_name` on
 *  the `Lead` event so Ads Manager can split the two buttons. */
export type LeadContentName = "speak_with_team" | "email_report";

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

/** Meta `Lead` conversion — fire exactly once per valid submission of a
 *  given CTA (callers guard the once-only part). */
export function trackLead(contentName: LeadContentName): void {
  trackStandardEvent("Lead", { content_name: contentName });
}

/** Path-tagged custom events, e.g. "AgencyHealthCheck_QuestionAnswered". */
export function trackCustomEvent(event: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("trackCustom", event, params);
}
