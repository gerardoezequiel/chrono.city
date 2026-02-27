import { useState, useEffect, useCallback, useRef } from 'react';
import type { SectionId } from '@/shared/types/metrics';

/**
 * Tracks which section is currently visible in the scrollable container.
 * Uses IntersectionObserver for efficient scroll-position detection.
 */
export function useScrollSpy(containerRef: React.RefObject<HTMLElement | null>): SectionId {
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sectionRefs = useRef<Map<string, IntersectionObserverEntry>>(new Map());

  const updateActive = useCallback((): void => {
    let best: string | null = null;
    let bestRatio = 0;
    for (const [id, entry] of sectionRefs.current) {
      if (entry.intersectionRatio > bestRatio) {
        bestRatio = entry.intersectionRatio;
        best = id;
      }
    }
    if (best) setActiveSection(best as SectionId);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute('data-section-id');
          if (id) sectionRefs.current.set(id, entry);
        }
        updateActive();
      },
      {
        root: container,
        threshold: [0, 0.25, 0.5, 0.75, 1.0],
      },
    );

    const sections = container.querySelectorAll('[data-section-id]');
    for (const el of sections) {
      observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
      sectionRefs.current.clear();
    };
  }, [containerRef, updateActive]);

  return activeSection;
}
