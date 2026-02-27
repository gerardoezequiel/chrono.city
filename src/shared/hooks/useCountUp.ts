import { useState, useEffect, useRef } from 'react';

const DURATION_MS = 600;
const FRAME_MS = 16;

/**
 * Animates a number from 0 to target over 600ms using ease-out.
 * Returns the current animated value.
 */
export function useCountUp(target: number | null | undefined): number | null {
  const [current, setCurrent] = useState<number | null>(null);
  const rafRef = useRef(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (target == null) {
      setCurrent(null);
      return;
    }

    startRef.current = performance.now();
    const from = 0;

    const tick = (): void => {
      const elapsed = performance.now() - startRef.current;
      const progress = Math.min(elapsed / DURATION_MS, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = from + (target - from) * eased;

      setCurrent(value);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setCurrent(target);
      }
    };

    // Small delay so the skeleton is visible briefly
    const timer = setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick);
    }, FRAME_MS);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return current;
}
