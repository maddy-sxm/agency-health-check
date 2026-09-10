"use client";

import { useState } from "react";
import { COPY } from "@/lib/copy";
import { SERVICE_OPTIONS } from "@/lib/questions";

interface HeroScreenProps {
  onStart: (selectedServiceIds: string[]) => void;
}

/** Screen 1 — headline + supporting copy + Q1 (services, non-scored,
 *  multi-select) live together as the single entry action, mirroring RAP's
 *  pattern of an immediate lightweight input on the hero rather than a
 *  separate "click to start" splash screen. */
export default function HeroScreen({ onStart }: HeroScreenProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  return (
    <div className="w-full max-w-md mx-auto text-center animate-fade-up">
      <div className="mb-4 font-mono text-[11px] tracking-[0.2em] uppercase text-red">{COPY.hero.eyebrow}</div>
      <h1 className="font-display font-extrabold uppercase text-4xl leading-[1.05] text-bone mb-4 md:text-5xl">
        {COPY.hero.headline}
      </h1>
      <p className="font-sans text-[15px] text-bone/80 leading-relaxed mb-10">{COPY.hero.sub}</p>

      <div className="text-left mb-8">
        <p className="font-sans text-[15px] font-semibold text-bone mb-1">{COPY.hero.servicesLabel}</p>
        <p className="font-mono text-[11px] tracking-[0.08em] uppercase text-smoke mb-4">{COPY.hero.servicesSub}</p>
        <div className="grid grid-cols-2 gap-2">
          {SERVICE_OPTIONS.map((option) => {
            const isSelected = selected.includes(option.id);
            return (
              <button
                key={option.id}
                onClick={() => toggle(option.id)}
                aria-pressed={isSelected}
                className={`px-4 py-3 rounded-lg border-2 text-[13px] font-sans font-medium text-center leading-snug transition-colors ${
                  isSelected ? "border-red bg-red/15 text-bone" : "border-line bg-ink-2 text-bone/80 hover:border-smoke"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => onStart(selected)}
        className="w-full bg-red hover:bg-red-bright text-white font-sans font-semibold text-sm tracking-wide uppercase py-4 rounded-[7px] transition-colors"
      >
        {COPY.hero.startCta} →
      </button>
    </div>
  );
}
