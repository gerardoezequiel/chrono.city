import { useState, useEffect, useRef } from 'react';

const DURATION_MS = 600;
const NUDGE_DURATION_MS = 300;
const FRAME_MS = 16;

/**
 * Animates a number from previous value to target using ease-out.
 * On first appearance: 0 → target (600ms).
 * On refinement (preview → DuckDB): previousValue → target (300ms for <10% delta).
 */
export function useCountUp(target: number | null | undefined): number | null {
  const [current, setCurrent] = useState<number | null>(null);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (target == null) {
      setCurrent(null);
      fromRef.current = 0;
      return;
    }

    startRef.current = performance.now();
    const from = fromRef.current;
    const delta = Math.abs(target - from);
    const duration = delta / Math.max(Math.abs(target), 1) < 0.1
      ? NUDGE_DURATION_MS
      : DURATION_MS;

    const tick = (): void => {
      const elapsed = performance.now() - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = from + (target - from) * eased;

      setCurrent(value);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setCurrent(target);
        fromRef.current = target;
      }
    };

    // Small delay on first appearance so skeleton is briefly visible.
    // Skip delay on refinement (preview→DuckDB) — value is already showing.
    if (from === 0) {
      const timer = setTimeout(() => {
        rafRef.current = requestAnimationFrame(tick);
      }, FRAME_MS);
      return () => { clearTimeout(timer); cancelAnimationFrame(rafRef.current); };
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [target]);

  return current;
}
