import { useState, useRef, useCallback, useEffect } from 'react';

interface MobileSheetProps {
  children: React.ReactNode;
}

const COLLAPSED = 80;
const HALF = 0.5;
const FULL = 0.88;

type Snap = 'collapsed' | 'half' | 'full';

function snapToPixels(snap: Snap, vh: number): number {
  if (snap === 'collapsed') return vh - COLLAPSED;
  if (snap === 'half') return vh * (1 - HALF);
  return vh * (1 - FULL);
}

export function MobileSheet({ children }: MobileSheetProps): React.ReactElement {
  const [snap, setSnap] = useState<Snap>('collapsed');
  const [translateY, setTranslateY] = useState<number | null>(null);
  const dragRef = useRef({ startY: 0, startTranslate: 0, active: false });
  const sheetRef = useRef<HTMLDivElement>(null);

  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  const currentY = translateY ?? snapToPixels(snap, vh);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    dragRef.current = {
      startY: touch.clientY,
      startTranslate: currentY,
      active: true,
    };
  }, [currentY]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current.active) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dy = touch.clientY - dragRef.current.startY;
    const newY = Math.max(snapToPixels('full', vh), Math.min(vh - 40, dragRef.current.startTranslate + dy));
    setTranslateY(newY);
  }, [vh]);

  const handleTouchEnd = useCallback(() => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    const y = translateY ?? snapToPixels(snap, vh);
    const collapsedY = snapToPixels('collapsed', vh);
    const halfY = snapToPixels('half', vh);
    const fullY = snapToPixels('full', vh);

    // Snap to nearest
    const dists: [Snap, number][] = [
      ['collapsed', Math.abs(y - collapsedY)],
      ['half', Math.abs(y - halfY)],
      ['full', Math.abs(y - fullY)],
    ];
    dists.sort((a, b) => a[1] - b[1]);
    const nearest = dists[0]?.[0] ?? 'collapsed';
    setSnap(nearest);
    setTranslateY(null);
  }, [translateY, snap, vh]);

  // Update on resize
  useEffect(() => {
    const onResize = (): void => { setTranslateY(null); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); };
  }, []);

  // Tap handle to cycle: collapsed → half → full → collapsed
  const handleTap = useCallback(() => {
    setSnap((s) => {
      if (s === 'collapsed') return 'half';
      if (s === 'half') return 'full';
      return 'collapsed';
    });
    setTranslateY(null);
  }, []);

  const isAnimating = translateY === null;

  return (
    <div
      ref={sheetRef}
      className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)]"
      style={{
        transform: `translateY(${currentY}px)`,
        height: vh,
        transition: isAnimating ? 'transform 300ms cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
        willChange: 'transform',
      }}
    >
      {/* Drag handle */}
      <div
        className="flex items-center justify-center py-3 cursor-grab active:cursor-grabbing shrink-0"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleTap}
      >
        <div className="w-10 h-1 rounded-full bg-neutral-300" />
      </div>

      {/* Content — scrollable */}
      <div className="h-full overflow-y-auto overflow-x-hidden pb-20">
        {children}
      </div>
    </div>
  );
}
