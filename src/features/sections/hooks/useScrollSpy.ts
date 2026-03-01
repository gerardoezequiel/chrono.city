import { useState, useEffect, useCallback, useRef } from 'react';
import type { SectionId } from '@/shared/types/metrics';

/**
 * Tracks which section is currently visible in the scrollable container.
 * Uses IntersectionObserver for scroll detection + MutationObserver
 * to pick up dynamically rendered sections.
 */
export function useScrollSpy(containerRef: React.RefObject<HTMLElement | null>): SectionId {
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const ratioMap = useRef<Map<string, number>>(new Map());

  const updateActive = useCallback((): void => {
    let best: string | null = null;
    let bestRatio = 0;
    for (const [id, ratio] of ratioMap.current) {
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = id;
      }
    }
    if (best) setActiveSection(best as SectionId);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute('data-section-id');
          if (id) ratioMap.current.set(id, entry.intersectionRatio);
        }
        updateActive();
      },
      { root: container, threshold: [0, 0.25, 0.5, 0.75, 1.0] },
    );
    observerRef.current = io;

    // Observe all current sections
    const observed = new Set<Element>();
    const observeSections = (): void => {
      const sections = container.querySelectorAll('[data-section-id]');
      for (const el of sections) {
        if (!observed.has(el)) {
          io.observe(el);
          observed.add(el);
        }
      }
    };
    observeSections();

    // Watch for dynamically added sections
    const mo = new MutationObserver(() => observeSections());
    mo.observe(container, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      ratioMap.current.clear();
    };
  }, [containerRef, updateActive]);

  return activeSection;
}
