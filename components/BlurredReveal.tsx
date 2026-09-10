import { COPY } from "@/lib/copy";

interface BlurredRevealProps {
  children: React.ReactNode;
}

/**
 * Wraps REAL, already-computed content (never placeholder text) in a
 * polished blur so the respondent can see a personalized report already
 * exists behind it, without reading the specifics. Used for the 3 locked
 * pillar cards, the rest of the strengths/weaknesses lists, and the "What
 * This Means" / "Recommended Next Step" bodies.
 */
export default function BlurredReveal({ children }: BlurredRevealProps) {
  return (
    <div className="relative">
      <div className="blur-[5px] select-none pointer-events-none" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-bone bg-ink/85 border border-line rounded-full px-3 py-1.5 whitespace-nowrap">
          {COPY.results.lockedLabel}
        </span>
      </div>
    </div>
  );
}
