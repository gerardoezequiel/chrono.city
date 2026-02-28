import { useCountUp } from '@/shared/hooks/useCountUp';

interface ChapterScore {
  label: string;
  score: number | null;
  weight: number;
}

interface ChronoScoreProps {
  chapters: ChapterScore[];
}

function gradeLabel(score: number): { grade: string; label: string } {
  if (score >= 85) return { grade: 'A', label: 'Good Urban Quality' };
  if (score >= 70) return { grade: 'B', label: 'Good' };
  if (score >= 55) return { grade: 'C', label: 'Moderate' };
  if (score >= 40) return { grade: 'D', label: 'Below Average' };
  return { grade: 'F', label: 'Car-Dependent' };
}

/**
 * Progressive Chrono Score gauge.
 * Shows 4 chapter scores as they resolve (null = pending).
 * Composite score updates as each chapter resolves.
 */
export function ChronoScore({ chapters }: ChronoScoreProps): React.ReactElement {
  const resolved = chapters.filter((c) => c.score != null);
  const resolvedCount = resolved.length;
  const totalChapters = chapters.length;

  // Compute weighted composite from resolved chapters only
  let compositeScore: number | null = null;
  if (resolvedCount > 0) {
    let weightedSum = 0;
    let weightTotal = 0;
    for (const ch of resolved) {
      weightedSum += (ch.score ?? 0) * ch.weight;
      weightTotal += ch.weight;
    }
    compositeScore = weightTotal > 0 ? weightedSum / weightTotal : null;
  }

  const animatedScore = useCountUp(compositeScore);
  const displayScore = animatedScore != null ? Math.round(animatedScore) : null;
  const grade = displayScore != null ? gradeLabel(displayScore) : null;

  return (
    <div className="px-6 py-5 border-b border-neutral-200">
      <div className="flex items-baseline justify-between">
        <h3 className="font-heading text-sm font-bold text-neutral-900 uppercase tracking-tight">Chrono Score</h3>
        <span className="font-mono text-[8px] text-neutral-400 uppercase tracking-wider">
          {resolvedCount}/{totalChapters} chapters
        </span>
      </div>

      {/* Score gauge */}
      <div className="mt-4 flex items-center gap-4">
        {/* Large score number */}
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-4xl font-bold text-neutral-900 tabular-nums tracking-tighter">
            {displayScore != null ? displayScore : '—'}
          </span>
          <span className="font-mono text-sm text-neutral-400">/100</span>
        </div>

        {/* Grade badge */}
        {grade && (
          <div className="flex flex-col">
            <span className="font-heading text-lg font-bold text-neutral-900 uppercase">{grade.grade}</span>
            <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-wider">{grade.label}</span>
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

      {/* Chapter breakdown */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {chapters.map((ch) => (
          <ChapterBadge key={ch.label} label={ch.label} score={ch.score} />
        ))}
      </div>

      {resolvedCount < totalChapters && (
        <p className="font-mono text-[9px] text-neutral-400 mt-3 italic">
          Scroll to explore each chapter. Score refines as data loads.
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
      <p className="font-mono text-[8px] text-neutral-400 uppercase tracking-widest mt-0.5">{label}</p>
    </div>
  );
}
