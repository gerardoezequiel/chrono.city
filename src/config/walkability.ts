/**
 * 15-minute city service category mapping.
 * Maps Overture place categories to essential service groups.
 * A complete 15-minute neighborhood has all groups covered.
 */
export const FIFTEEN_MIN_CATEGORIES: Record<string, string[]> = {
  'Food & Grocery': [
    'grocery', 'supermarket', 'market', 'bakery', 'butcher',
    'greengrocer', 'deli', 'food',
  ],
  'Healthcare': [
    'hospital', 'clinic', 'doctor', 'dentist', 'pharmacy',
    'health', 'medical', 'optician', 'veterinary',
  ],
  'Education': [
    'school', 'kindergarten', 'college', 'university', 'library',
    'education', 'training', 'childcare', 'daycare',
  ],
  'Shopping': [
    'shop', 'store', 'retail', 'mall', 'clothing', 'hardware',
    'electronics', 'furniture', 'bookstore', 'convenience',
  ],
  'Leisure & Culture': [
    'restaurant', 'cafe', 'bar', 'pub', 'cinema', 'theater',
    'museum', 'gallery', 'gym', 'fitness', 'sport', 'park',
    'playground', 'recreation', 'entertainment', 'coffee',
  ],
  'Civic & Transit': [
    'post_office', 'bank', 'atm', 'police', 'fire_station',
    'government', 'community', 'transit', 'bus', 'station',
    'subway', 'tram', 'ferry', 'worship', 'church', 'mosque',
  ],
};

/** Total number of service groups for completeness scoring */
export const TOTAL_SERVICE_GROUPS = Object.keys(FIFTEEN_MIN_CATEGORIES).length;
