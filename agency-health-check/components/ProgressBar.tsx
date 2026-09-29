interface ProgressBarProps {
  /** 1-indexed current step. */
  current: number;
  total: number;
}

/** Slim tracked progress bar shown above every question screen. Two
 *  independent instances are used across the flow — one for the 8-question
 *  diagnostic stage, one for the 4-question qualification stage — so
 *  neither stage's step count inflates the other's. */
export default function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = Math.min((current / total) * 100, 100);
  return (
    <div className="w-full max-w-md mx-auto mb-8" aria-hidden>
      <div className="h-[3px] w-full bg-line rounded-full overflow-hidden">
        <div className="h-full bg-red transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
