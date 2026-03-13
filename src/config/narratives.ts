import type { SectionId } from '@/shared/types/metrics';

export interface SectionNarrative {
  /** Introductory text shown immediately (visual phase) */
  intro: string;
  /** What to look for on the map */
  mapHint: string;
  /** Data-enriched summary template — {key} placeholders replaced with metric values */
  resolved?: string;
}

export const SECTION_NARRATIVES: Record<SectionId, SectionNarrative> = {
  overview: {
    intro: 'A composite reading of urban quality across morphology, connectivity, vitality, and resilience.',
    mapHint: 'The study area is highlighted on the map. Scroll to explore each chapter.',
  },
  buildings: {
    intro: 'Building footprints reveal the city\'s DNA — dense, fine-grained patterns indicate walkable neighborhoods. Sprawling megablocks signal car dependency.',
    mapHint: 'Look at the footprints on the map. Small, tightly packed buildings suggest a mature, walkable urban fabric.',
  },
  network: {
    intro: 'Street connectivity determines how efficiently you can move through the city. Dense intersections and short blocks create more direct routes.',
    mapHint: 'Notice how the street grid is structured. Regular grids offer legibility. Organic patterns suggest historical layers.',
  },
  amenities: {
    intro: 'The 15-minute city asks: can you reach daily essentials on foot? Groceries, schools, healthcare, transit — diversity of services matters more than raw count.',
    mapHint: 'Dots represent points of interest. Clusters indicate commercial activity. Gaps may signal service deserts.',
  },
  walkability: {
    intro: 'A truly walkable neighborhood provides all daily essentials within a 15-minute walk. Six service groups — food, health, education, shopping, leisure, and civic — define completeness.',
    mapHint: 'Each service group is checked against nearby POIs. Green checks mean coverage. Missing groups reveal urban gaps.',
  },
};
