"use client";

import Script from "next/script";
import { GOOGLE_ADS_ID } from "@/lib/tracking";

/**
 * Google tag (gtag.js) for the Google Ads account, rendered once in
 * app/layout.tsx — Google's "immediately after <head>" snippet, split into
 * the async loader plus the inline dataLayer/config bootstrap. Only one
 * Google tag may be on the page; add further ids via gtag('config', ...)
 * here rather than a second loader.
 */
export default function GoogleTag() {
  if (!GOOGLE_ADS_ID) return null;

  return (
    <>
      <Script
        id="google-tag-loader"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
      />
      <Script id="google-tag-config" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GOOGLE_ADS_ID}');
        `}
      </Script>
    </>
  );
}
