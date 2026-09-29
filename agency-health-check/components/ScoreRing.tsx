interface ScoreRingProps {
  score: number; // 0-100
}

const SIZE = 168;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Circular score gauge — a static evolution of the AnalyzingScreen's
 *  radar-sweep motif, so the loading screen and the final score read as
 *  the same visual idea completing. */
export default function ScoreRing({ score }: ScoreRingProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#2a2a2a" strokeWidth={STROKE} />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#d9573b"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex items-baseline justify-center gap-1">
        <span className="font-display font-extrabold text-bone text-5xl leading-none">{clamped}</span>
        <span className="font-display font-semibold text-smoke text-lg leading-none">/100</span>
      </div>
    </div>
  );
}
