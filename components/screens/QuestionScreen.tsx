"use client";

import { useEffect, useState } from "react";
import ProgressBar from "@/components/ProgressBar";
import type { QuestionOption } from "@/lib/types";

interface QuestionScreenProps {
  eyebrow: string;
  headline: string;
  sub?: string;
  options: QuestionOption[];
  onSelect: (optionId: string) => void;
  onBack?: () => void;
  progress: { current: number; total: number };
}

// How long the picked answer stays visibly highlighted before the screen
// advances — long enough to register as real feedback, short enough not
// to feel like a delay. Matches the red highlight HeroScreen's service
// chips already use for their (persistent) selected state.
const SELECT_HIGHLIGHT_MS = 280;

/** One diagnostic or qualification question per screen. Answers are
 *  full sentences, not single words, so options render as large, single-
 *  column, left-aligned cards rather than a 2-up grid of short buttons.
 *
 *  Parent must pass `key={question.id}` when rendering this — that's what
 *  resets `selectedId` between questions instead of it persisting into the
 *  next screen (React reuses this component instance across questions
 *  otherwise, since it stays in the same JSX position). */
export default function QuestionScreen({ eyebrow, headline, sub, options, onSelect, onBack, progress }: QuestionScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (optionId: string) => {
    if (selectedId) return; // already advancing — ignore extra clicks
    setSelectedId(optionId);
  };

  useEffect(() => {
    if (!selectedId) return;
    const timer = setTimeout(() => onSelect(selectedId), SELECT_HIGHLIGHT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div className="w-full max-w-md mx-auto animate-fade-up">
      <ProgressBar current={progress.current} total={progress.total} />
      <div className="text-center">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-4 font-mono text-[11px] tracking-[0.15em] uppercase text-smoke hover:text-bone transition-colors"
          >
            ← Back
          </button>
        )}
        <div className="mb-4 font-mono text-[11px] tracking-[0.2em] uppercase text-red">{eyebrow}</div>
        <h1 className="font-display font-extrabold text-2xl leading-[1.2] text-bone mb-3 md:text-3xl">{headline}</h1>
        {sub && <p className="font-sans text-[14px] text-bone/70 leading-relaxed mb-8">{sub}</p>}
      </div>

      <div className="flex flex-col gap-3">
        {options.map((option) => {
          const isSelected = option.id === selectedId;
          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              aria-pressed={isSelected}
              className={`text-left font-sans font-medium text-[15px] leading-snug px-5 py-4 rounded-[10px] border-2 transition-colors ${
                isSelected ? "border-red bg-red/15 text-bone" : "bg-ink-2 border-line hover:border-red text-bone"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
