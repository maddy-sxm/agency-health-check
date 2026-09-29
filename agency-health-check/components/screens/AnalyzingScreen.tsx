"use client";

import { useEffect, useState } from "react";

interface AnalyzingScreenProps {
  messages: readonly string[];
  /** Fired once, after the staged messages have finished playing out. */
  onDone: () => void;
}

const STEP_MS = 1100;

/**
 * Radar-scan "diagnostic" animation — the same loading language as RAP
 * (revenue-activation-plan.speedxmedia.com): a sweeping radar with
 * crosshair corner brackets reads as "a diagnostic is actively running"
 * rather than a generic spinner. Runs for messages.length * STEP_MS
 * regardless of any underlying async work, since scoring here is a pure,
 * instant local computation — this screen exists purely for pacing.
 */
export default function AnalyzingScreen({ messages, onDone }: AnalyzingScreenProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= messages.length - 1) {
      const done = setTimeout(onDone, STEP_MS);
      return () => clearTimeout(done);
    }
    const next = setTimeout(() => setIndex((i) => i + 1), STEP_MS);
    return () => clearTimeout(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const progressPct = Math.min(((index + 1) / messages.length) * 100, 100);

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center text-center py-16 animate-fade-in">
      <div className="relative w-40 h-40 mb-10 flex items-center justify-center">
        {/* Corner brackets */}
        <span className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-red/70" aria-hidden />
        <span className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-red/70" aria-hidden />
        <span className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-red/70" aria-hidden />
        <span className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-red/70" aria-hidden />

        <div className="absolute inset-0 rounded-full bg-red/10 blur-2xl animate-pulse-soft" aria-hidden />
        <div className="absolute inset-3 rounded-full border border-line" aria-hidden />
        <div className="absolute inset-8 rounded-full border border-line" aria-hidden />
        <div className="absolute inset-[52px] rounded-full border border-line" aria-hidden />

        <svg viewBox="0 0 160 160" className="absolute inset-0 w-full h-full overflow-visible animate-radar-spin">
          <defs>
            <linearGradient id="radarSweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#d9573b" stopOpacity="0" />
              <stop offset="100%" stopColor="#d9573b" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <path d="M 80 80 L 80 6 A 74 74 0 0 1 148 60 Z" fill="url(#radarSweep)" />
        </svg>

        <div className="relative w-2.5 h-2.5 rounded-full bg-red-bright shadow-[0_0_12px_2px_rgba(217,87,59,0.6)]" />
      </div>

      <div className="h-10 mb-8 px-6">
        <p key={index} className="font-display text-lg md:text-xl text-bone animate-fade-in">
          {messages[index]}
        </p>
      </div>

      <div className="w-48 h-[2px] bg-line rounded-full overflow-hidden">
        <div className="h-full bg-red transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
      </div>
    </div>
  );
}
