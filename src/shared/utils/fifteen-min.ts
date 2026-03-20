/**
 * Maps Overture primary place categories to 8 "15-minute city" groups.
 * Used by both DuckDB query results and PMTiles preview.
 *
 * Returns Record<string, boolean> for ServiceChecklist chart rendering.
 */

/** The 8 macro-categories for a 15-minute city assessment */
export const FIFTEEN_MIN_GROUPS = [
  'Food & Drink',
  'Health',
  'Education',
  'Shopping',
  'Leisure & Sport',
  'Civic Services',
  'Culture',
  'Transport',
] as const;

export type FifteenMinGroup = (typeof FIFTEEN_MIN_GROUPS)[number];

/**
 * Map of Overture primary category → 15-minute city group.
 * Not exhaustive — unmapped categories are ignored.
 */
const CATEGORY_MAP: Record<string, FifteenMinGroup> = {
  // ─── Kontur aggregate categories (H3 cell preview) ───
  food_and_drink: 'Food & Drink',
  health: 'Health',
  education: 'Education',
  shopping: 'Shopping',
  leisure_and_sport: 'Leisure & Sport',
  public_service: 'Civic Services',
  accommodation: 'Shopping',
  finance: 'Civic Services',

  // ─── Overture primary categories (DuckDB query results) ───
  // Food & Drink
  restaurant: 'Food & Drink',
  cafe: 'Food & Drink',
  bar: 'Food & Drink',
  fast_food_restaurant: 'Food & Drink',
  bakery: 'Food & Drink',
  grocery_store: 'Food & Drink',
  supermarket: 'Food & Drink',
  food_court: 'Food & Drink',
  coffee_shop: 'Food & Drink',
  pub: 'Food & Drink',
  deli: 'Food & Drink',
  ice_cream_shop: 'Food & Drink',
  juice_bar: 'Food & Drink',
  pizza_restaurant: 'Food & Drink',
  seafood_restaurant: 'Food & Drink',
  sushi_restaurant: 'Food & Drink',
  breakfast_restaurant: 'Food & Drink',
  burger_restaurant: 'Food & Drink',
  mexican_restaurant: 'Food & Drink',
  chinese_restaurant: 'Food & Drink',
  indian_restaurant: 'Food & Drink',
  italian_restaurant: 'Food & Drink',
  thai_restaurant: 'Food & Drink',
  vietnamese_restaurant: 'Food & Drink',
  japanese_restaurant: 'Food & Drink',
  korean_restaurant: 'Food & Drink',
  food_truck: 'Food & Drink',
  butcher_shop: 'Food & Drink',
  farmers_market: 'Food & Drink',
  wine_bar: 'Food & Drink',
  cocktail_bar: 'Food & Drink',
  lounge: 'Food & Drink',
  beer_garden: 'Food & Drink',
  tea_room: 'Food & Drink',

  // Health
  hospital: 'Health',
  pharmacy: 'Health',
  dentist: 'Health',
  doctor: 'Health',
  clinic: 'Health',
  veterinarian: 'Health',
  optician: 'Health',
  medical_center: 'Health',
  urgent_care_center: 'Health',
  health_and_beauty_service: 'Health',

  // Education
  school: 'Education',
  university: 'Education',
  kindergarten: 'Education',
  college: 'Education',
  library: 'Education',
  language_school: 'Education',
  driving_school: 'Education',
  preschool: 'Education',
  tutoring_service: 'Education',
  music_school: 'Education',

  // Shopping
  clothing_store: 'Shopping',
  convenience_store: 'Shopping',
  shopping_mall: 'Shopping',
  department_store: 'Shopping',
  shoe_store: 'Shopping',
  electronics_store: 'Shopping',
  furniture_store: 'Shopping',
  bookstore: 'Shopping',
  hardware_store: 'Shopping',
  pet_store: 'Shopping',
  toy_store: 'Shopping',
  gift_shop: 'Shopping',
  jewelry_store: 'Shopping',
  sporting_goods_store: 'Shopping',
  thrift_store: 'Shopping',
  florist: 'Shopping',
  market: 'Shopping',
  outlet_store: 'Shopping',
  discount_store: 'Shopping',

  // Leisure & Sport
  park: 'Leisure & Sport',
  gym: 'Leisure & Sport',
  playground: 'Leisure & Sport',
  swimming_pool: 'Leisure & Sport',
  sports_club: 'Leisure & Sport',
  fitness_center: 'Leisure & Sport',
  yoga_studio: 'Leisure & Sport',
  recreation_center: 'Leisure & Sport',
  stadium: 'Leisure & Sport',
  tennis_court: 'Leisure & Sport',
  golf_course: 'Leisure & Sport',
  bowling_alley: 'Leisure & Sport',
  skating_rink: 'Leisure & Sport',
  spa: 'Leisure & Sport',
  garden: 'Leisure & Sport',

  // Civic Services
  post_office: 'Civic Services',
  police_station: 'Civic Services',
  fire_station: 'Civic Services',
  government_office: 'Civic Services',
  community_center: 'Civic Services',
  courthouse: 'Civic Services',
  embassy: 'Civic Services',
  town_hall: 'Civic Services',
  social_services: 'Civic Services',

  // Culture
  museum: 'Culture',
  art_gallery: 'Culture',
  theater: 'Culture',
  cinema: 'Culture',
  concert_hall: 'Culture',
  cultural_center: 'Culture',
  historic_site: 'Culture',
  monument: 'Culture',
  performing_arts_venue: 'Culture',
  music_venue: 'Culture',
  nightclub: 'Culture',
  event_space: 'Culture',
  religious_organization: 'Culture',
  place_of_worship: 'Culture',

  // Transport
  bus_station: 'Transport',
  train_station: 'Transport',
  subway_station: 'Transport',
  tram_stop: 'Transport',
  ferry_terminal: 'Transport',
  airport: 'Transport',
  taxi_stand: 'Transport',
  bike_rental: 'Transport',
  car_rental: 'Transport',
  parking_lot: 'Transport',
  gas_station: 'Transport',
  charging_station: 'Transport',
  transportation_service: 'Transport',
  travel_agency: 'Transport',
};

/**
 * Classify a category distribution into 15-minute city groups.
 * Returns Record<groupName, boolean> for ServiceChecklist rendering.
 */
export function classifyFifteenMin(
  categoryDistribution: Record<string, number>,
): Record<string, boolean> {
  const found = new Set<FifteenMinGroup>();

  for (const [cat, count] of Object.entries(categoryDistribution)) {
    if (count <= 0) continue;
    const group = CATEGORY_MAP[cat];
    if (group) found.add(group);
  }

  const result: Record<string, boolean> = {};
  for (const group of FIFTEEN_MIN_GROUPS) {
    result[group] = found.has(group);
  }
  return result;
}
