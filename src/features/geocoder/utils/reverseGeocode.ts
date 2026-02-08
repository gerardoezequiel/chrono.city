import type { LngLat } from '@/shared/types/geo';

const PHOTON_REVERSE = 'https://photon.komoot.io/reverse';

export interface ReverseResult {
  street: string;
  city: string;
}

/** Reverse geocode via Photon (OSM-based, free, CORS-friendly, has street names) */
export async function reverseGeocode(lngLat: LngLat, signal?: AbortSignal): Promise<ReverseResult | null> {
  try {
    const params = new URLSearchParams({
      lon: String(lngLat.lng),
      lat: String(lngLat.lat),
      limit: '1',
      lang: 'en',
    });
    const res = await fetch(`${PHOTON_REVERSE}?${params}`, { signal });
    if (!res.ok) return null;

    const data = await res.json() as {
      features: Array<{
        properties: {
          name?: string;
          street?: string;
          housenumber?: string;
          district?: string;
          city?: string;
          state?: string;
          country?: string;
        };
      }>;
    };

    const props = data.features[0]?.properties;
    if (!props) return null;

    // Street: prefer street + housenumber, fall back to name or district
    const streetName = props.street
      ? (props.housenumber ? `${props.street} ${props.housenumber}` : props.street)
      : (props.name || props.district || '');

    const city = props.city || props.state || '';

    return {
      street: streetName || city || 'Unknown',
      city,
    };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    return null;
  }
}
