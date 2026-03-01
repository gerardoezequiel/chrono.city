import { useCountUp } from '@/shared/hooks/useCountUp';
import type { ChronoScore as ChronoScoreType, ChapterName } from '@/data/scoring/types';

const CHAPTER_ORDER: ChapterName[] = [
  'fabric', 'connectivity', 'vitality', 'resilience',
  'prosperity', 'environment', 'culture',
];

const CHAPTER_LABELS: Record<ChapterName, string> = {
  fabric: 'Fabric',
  resilience: 'Resilience',
  vitality: 'Vitality',
  connectivity: 'Connect.',
  prosperity: 'Prosperity',
  environment: 'Environ.',
  culture: 'Culture',
};

interface ChronoScoreProps {
  score: ChronoScoreType | null;
}

/**
 * Progressive Chrono Score gauge with 7-chapter breakdown.
 * Shows real score from scoring framework when available.
 * Top row: 4 chapters, bottom row: 3 chapters.
 */
export function ChronoScore({ score }: ChronoScoreProps): React.ReactElement {
  const compositeScore = score?.score ?? null;
  const animatedScore = useCountUp(compositeScore);
  const displayScore = animatedScore != null ? Math.round(animatedScore) : null;
  const grade = score?.grade ?? null;
  const confidence = score?.confidence ?? null;

  return (
    <div className="px-4 md:px-6 py-4 md:py-5 border-b border-neutral-200">
      <div className="flex items-baseline justify-between">
        <h3 className="font-heading text-sm font-bold text-neutral-900 uppercase tracking-tight">Chrono Score</h3>
        {confidence != null && (
          <span className="font-mono text-[11px] md:text-[8px] text-neutral-400 uppercase tracking-wider">
            {Math.round(confidence * 100)}% confidence
          </span>
        )}
      </div>

      {/* Score gauge */}
      <div className="mt-4 flex items-center gap-4">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-3xl md:text-4xl font-bold text-neutral-900 tabular-nums tracking-tighter">
            {displayScore != null ? displayScore : '\u2014'}
          </span>
          <span className="font-mono text-sm text-neutral-400">/100</span>
        </div>

        {grade && (
          <div className="flex flex-col">
            <span className="font-heading text-lg font-bold text-neutral-900 uppercase">{grade}</span>
            <span className="font-mono text-[11px] md:text-[9px] text-neutral-400 uppercase tracking-wider">{gradeLabel(grade)}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1 bg-neutral-100 w-full">
        <div
          className="h-full bg-neutral-900 transition-all duration-700 ease-out"
          style={{ width: `${displayScore ?? 0}%` }}
        />
      </div>

      {/* 7-chapter breakdown: 4 top + 3 bottom */}
      {score ? (
        <>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {CHAPTER_ORDER.slice(0, 4).map((ch) => (
              <ChapterBadge key={ch} label={CHAPTER_LABELS[ch]} score={score.chapters[ch]?.score ?? null} />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {CHAPTER_ORDER.slice(4).map((ch) => (
              <ChapterBadge key={ch} label={CHAPTER_LABELS[ch]} score={score.chapters[ch]?.score ?? null} />
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {CHAPTER_ORDER.slice(0, 4).map((ch) => (
            <ChapterBadge key={ch} label={CHAPTER_LABELS[ch]} score={null} />
          ))}
        </div>
      )}

      {!score && (
        <p className="font-mono text-[11px] md:text-[9px] text-neutral-400 mt-3 italic">
          Click a location to compute the Chrono Score.
        </p>
      )}
    </div>
  );
}

function ChapterBadge({ label, score }: { label: string; score: number | null }): React.ReactElement {
  const animated = useCountUp(score);
  const display = animated != null ? Math.round(animated) : null;

  return (
    <div className={`border p-2 text-center transition-colors duration-300 ${
      score != null ? 'border-neutral-300 bg-white' : 'border-neutral-100 bg-neutral-50'
    }`}>
      <p className="font-mono text-sm font-bold tabular-nums text-neutral-900">
        {display != null ? display : (
          <span className="inline-block w-6 h-4 bg-neutral-100 animate-pulse" />
        )}
      </p>
      <p className="font-mono text-[11px] md:text-[8px] text-neutral-400 uppercase tracking-widest mt-0.5">{label}</p>
    </div>
  );
}

function gradeLabel(grade: string): string {
  switch (grade) {
    case 'A': return 'Excellent';
    case 'B': return 'Good';
    case 'C': return 'Moderate';
    case 'D': return 'Below Avg';
    case 'F': return 'Car-Dependent';
    default: return '';
  }
}
