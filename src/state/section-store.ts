import { create } from 'zustand';
import type { LngLat, StudyAreaMode } from '@/shared/types/geo';
import type { SectionId } from '@/shared/types/metrics';
import type { ReverseResult } from '@/features/geocoder';

interface SectionState {
  /** User-selected origin point on the map */
  origin: LngLat | null;
  /** Reverse geocoded result for the origin */
  reverseResult: ReverseResult | null;
  /** Study area mode: ring buffer or Valhalla isochrone */
  studyAreaMode: StudyAreaMode;
  /** Custom walk time in minutes (null = use presets) */
  customMinutes: number | null;
  /** Whether the origin marker is currently being dragged */
  isDragging: boolean;
  /** Currently active (scrolled-to) sidebar section */
  activeSection: SectionId;

  setOrigin: (origin: LngLat | null) => void;
  setReverseResult: (result: ReverseResult | null) => void;
  setStudyAreaMode: (mode: StudyAreaMode) => void;
  setCustomMinutes: (minutes: number | null) => void;
  setIsDragging: (dragging: boolean) => void;
  setActiveSection: (section: SectionId) => void;
  /** Clear all origin-related state */
  clearOrigin: () => void;
}

export const useSectionStore = create<SectionState>((set) => ({
  origin: null,
  reverseResult: null,
  studyAreaMode: 'ring',
  customMinutes: null,
  isDragging: false,
  activeSection: 'overview',

  setOrigin: (origin) => set({ origin }),
  setReverseResult: (reverseResult) => set({ reverseResult }),
  setStudyAreaMode: (studyAreaMode) => set({ studyAreaMode }),
  setCustomMinutes: (customMinutes) => set({ customMinutes }),
  setIsDragging: (isDragging) => set({ isDragging }),
  setActiveSection: (activeSection) => set({ activeSection }),
  clearOrigin: () => set({ origin: null, reverseResult: null, isDragging: false }),
}));
