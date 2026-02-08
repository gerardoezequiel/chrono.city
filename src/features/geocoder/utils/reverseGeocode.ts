import type { LngLat } from '@/shared/types/geo';

const BIGDATA_REVERSE = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

export interface ReverseResult {
  street: string;
  city: string;
}

/** Reverse geocode via BigDataCloud (free, no key, browser-native CORS) */
export async function reverseGeocode(lngLat: LngLat, signal?: AbortSignal): Promise<ReverseResult | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(lngLat.lat),
      longitude: String(lngLat.lng),
      localityLanguage: 'en',
    });
    const res = await fetch(`${BIGDATA_REVERSE}?${params}`, { signal });
    if (!res.ok) return null;

    const data = await res.json() as {
      locality?: string;
      city?: string;
      principalSubdivision?: string;
      countryName?: string;
      localityInfo?: {
        administrative?: Array<{ name?: string; order?: number }>;
      };
    };

    // Extract most specific administrative name (highest order = most local)
    const admins = data.localityInfo?.administrative ?? [];
    const sorted = [...admins].sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
    const mostSpecific = sorted[0]?.name ?? '';
    const secondMost = sorted[1]?.name ?? '';

    const locality = data.locality || '';
    const city = data.city || '';

    // Street: use the most specific admin name, fall back to locality
    // If most specific IS the locality/city, try second-most for finer detail
    const street = (mostSpecific && mostSpecific !== locality && mostSpecific !== city)
      ? mostSpecific
      : (secondMost && secondMost !== locality && secondMost !== city)
        ? secondMost
        : locality || city || data.principalSubdivision || 'Unknown';

    // City: use locality if different from street, else city
    const displayCity = (locality && locality !== street) ? locality
      : (city && city !== street) ? city
      : data.principalSubdivision || '';

    return { street, city: displayCity };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    return null;
  }
}
