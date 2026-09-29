import BlurredReveal from "@/components/BlurredReveal";
import { PILLAR_RATING_INTERPRETATION } from "@/lib/pillars";
import type { PillarRating, PillarResult } from "@/lib/types";

const RATING_BADGE_STYLES: Record<PillarRating, string> = {
  Strong: "text-keep-bright border-keep/40 bg-keep/10",
  Developing: "text-amber-bright border-amber/40 bg-amber/10",
  "At Risk": "text-red-bright border-red/40 bg-red/10",
  Critical: "text-red-bright border-red/60 bg-red/20",
};

const RATING_BAR_COLOR: Record<PillarRating, string> = {
  Strong: "bg-keep-bright",
  Developing: "bg-amber-bright",
  "At Risk": "bg-red",
  Critical: "bg-red-bright",
};

const PILLAR_MAX = 6;

function PillarScoreBlock({ pillar }: { pillar: PillarResult }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <span className="font-display font-extrabold text-xl text-bone">
          {pillar.rawScore}/{PILLAR_MAX}
        </span>
        <span
          className={`text-[11px] font-mono uppercase tracking-[0.08em] font-semibold px-2.5 py-1 rounded-full border ${RATING_BADGE_STYLES[pillar.rating]}`}
        >
          {pillar.rating}
        </span>
      </div>
      <div className="flex gap-1 mb-3" aria-hidden>
        {Array.from({ length: PILLAR_MAX }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < pillar.rawScore ? RATING_BAR_COLOR[pillar.rating] : "bg-line"}`}
          />
        ))}
      </div>
      <p className="text-[13px] text-bone/70 leading-relaxed">{PILLAR_RATING_INTERPRETATION[pillar.rating]}</p>
    </div>
  );
}

interface PillarCardProps {
  pillar: PillarResult;
  description: string;
  /** Communication & Access is always false (always fully revealed); the
   *  other 3 pillars are always true — see ReportPreviewScreen. Never chosen
   *  dynamically per respondent. */
  locked: boolean;
}

export default function PillarCard({ pillar, description, locked }: PillarCardProps) {
  return (
    <div className="bg-ink-2 border border-line rounded-[12px] p-4">
      <div className="font-sans text-[15px] font-semibold text-bone mb-1">{pillar.label}</div>
      <p className="text-[13px] text-bone/60 leading-relaxed mb-3">{description}</p>
      {locked ? (
        <BlurredReveal>
          <PillarScoreBlock pillar={pillar} />
        </BlurredReveal>
      ) : (
        <PillarScoreBlock pillar={pillar} />
      )}
    </div>
  );
}
