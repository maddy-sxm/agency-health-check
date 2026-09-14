"use client";

import Script from "next/script";
import { LINKEDIN_PARTNER_ID } from "@/lib/tracking";

/**
 * LinkedIn Insight Tag base code, rendered once in app/layout.tsx. Mirrors
 * LinkedIn's official snippet: register the partner id, then load
 * insight.min.js asynchronously; the <noscript> pixel covers no-JS clients.
 */
export default function LinkedInInsight() {
  if (!LINKEDIN_PARTNER_ID) return null;

  return (
    <>
      <Script id="linkedin-insight" strategy="afterInteractive">
        {`
          _linkedin_partner_id = "${LINKEDIN_PARTNER_ID}";
          window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
          window._linkedin_data_partner_ids.push(_linkedin_partner_id);
          (function(l) {
            if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
            window.lintrk.q=[]}
            var s = document.getElementsByTagName("script")[0];
            var b = document.createElement("script");
            b.type = "text/javascript";b.async = true;
            b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
            s.parentNode.insertBefore(b, s);})(window.lintrk);
        `}
      </Script>
      {/* Server-rendered only, so the pixel isn't also fetched by JS clients. */}
      <noscript
        dangerouslySetInnerHTML={{
          __html: `<img height="1" width="1" style="display:none;" alt="" src="https://px.ads.linkedin.com/collect/?pid=${LINKEDIN_PARTNER_ID}&fmt=gif" />`,
        }}
      />
    </>
  );
}
