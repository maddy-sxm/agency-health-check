/**
 * Third-party ad/analytics tags other than the Meta Pixel (see lib/pixel.ts).
 * Each base tag is rendered exactly once from app/layout.tsx via next/script,
 * which is the Next.js App Router equivalent of "paste it in <head>": the
 * snippet is injected on every page as soon as the page is interactive.
 */

/** LinkedIn Insight Tag partner id — components/LinkedInInsight.tsx */
export const LINKEDIN_PARTNER_ID = "8691466";

/** Google Ads tag (gtag.js) — components/GoogleTag.tsx */
export const GOOGLE_ADS_ID = "AW-17879019755";

declare global {
  interface Window {
    /** LinkedIn Insight Tag — queue + tracker installed by insight.min.js */
    lintrk?: (action: string, payload?: Record<string, unknown>) => void;
    _linkedin_partner_id?: string;
    _linkedin_data_partner_ids?: string[];
    /** Google tag */
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
