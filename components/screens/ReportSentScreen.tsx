"use client";

import { COPY } from "@/lib/copy";

interface ReportSentScreenProps {
  name: string;
  email: string;
  onStartOver: () => void;
}

/**
 * Post-submission confirmation for the "report" path. The respondent
 * already saw the full score/pillar/strengths preview on
 * ReportPreviewScreen before submitting, so this is deliberately just a
 * receipt, not a repeat of that content. The "call" path never reaches
 * this screen — it redirects straight to CTA_HREF instead.
 */
export default function ReportSentScreen({ name, email, onStartOver }: ReportSentScreenProps) {
  return (
    <div className="w-full max-w-md mx-auto text-center animate-reveal-scale">
      {name && (
        <p className="mb-6 font-mono text-[11px] tracking-[0.15em] uppercase text-smoke">
          {COPY.results.preparedFor} {name}
        </p>
      )}

      <div className="bg-ink-2 border border-line rounded-[14px] px-5 py-8">
        <div className="mb-4 flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-ink border border-line flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3" y="5" width="18" height="14" rx="2" stroke="#1fbf6b" strokeWidth="1.8" />
              <path d="m3 7 9 6 9-6" stroke="#1fbf6b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <p className="font-display font-bold uppercase text-xl text-bone mb-2">{COPY.results.reportSentHeading}</p>
        <p className="text-[14px] text-bone/80 leading-relaxed">{COPY.results.reportSentBody.replace("{email}", email)}</p>
      </div>

      <button
        onClick={onStartOver}
        className="w-full text-center font-mono text-[11px] tracking-[0.15em] uppercase text-smoke hover:text-bone transition-colors py-2 mt-8"
      >
        {COPY.results.startOver}
      </button>
    </div>
  );
}
