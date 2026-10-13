/**
 * Coordonnées d'une adresse (Nominatim, OpenStreetMap) : l'app s'en sert pour trier les salles par distance.
 *
 * Politique d'usage de Nominatim : une requête par seconde au plus, un User-Agent qui identifie l'application, pas de
 * collecte en masse. On ne cherche donc une salle qu'UNE fois : la collecte suivante reprend les coordonnées déjà
 * publiées tant que l'adresse ne change pas (voir locateTheaters dans cinebel.mjs).
 *
 * Adresse attendue : { street, postalCode, city, country } avec country = 'be', 'lu' ou 'fr' (code ISO, minuscules).
 */

export class GeocoderError extends Error {}

/** Belgique et Luxembourg (Cinebel liste aussi quelques salles luxembourgeoises) : hors de ce cadre, c'est une mauvaise correspondance. */
export const inBelgiumLuxembourg = (lat, lng) => lat >= 49.4 && lat <= 51.6 && lng >= 2.5 && lng <= 6.6;
/** France métropolitaine et Corse (les grandes villes de Linternaute). */
export const inFrance = (lat, lng) => lat >= 41.2 && lat <= 51.2 && lng >= -5.3 && lng <= 9.7;

/** Pays pris en charge, et le cadre où doit tomber une bonne correspondance. */
const AREAS = { be: inBelgiumLuxembourg, lu: inBelgiumLuxembourg, fr: inFrance };
const countryOf = (address) => (address?.country in AREAS ? address.country : 'be');

/** Numéro de rue final : « 8-17 », « 12 », « 12A », « 12/3 », « 12 bte 3 » (pas un nombre qui fait partie du nom : « Rue du 11 Novembre »). */
const HOUSE_NUMBER = /[\s,]+\d+[A-Za-z]?(?:\s*[-/]\s*\d+[A-Za-z]?)*(?:\s+(?:bte|bus|box)\s*\w+)?\s*$/i;
/** En France, le numéro vient d'abord : « 54 Rue de Chanterac », « 12 bis avenue X », « 8-10, place Y ». */
const LEADING_HOUSE_NUMBER = /^\d+[A-Za-z]?(?:\s*-\s*\d+[A-Za-z]?)?(?:\s+(?:bis|ter))?\s*,?\s+(?=\D)/i;

/** Recherches à essayer, de la plus précise à la plus large : adresse complète, rue sans numéro, code postal et ville. */
export function geocodeQueries({ street = '', postalCode = '', city = '', country = 'be' }) {
  const place = [postalCode, city].filter(Boolean).join(' ');
  const bare = (country === 'fr' ? street.replace(LEADING_HOUSE_NUMBER, '') : street.replace(HOUSE_NUMBER, '')).trim();
  const queries = [];
  if (street) queries.push({ q: `${street}, ${place}`, precision: 'address' });
  if (bare && bare !== street) queries.push({ q: `${bare}, ${place}`, precision: 'street' });
  if (place) queries.push({ q: place, precision: 'postcode' });
  return queries;
}

const round4 = (n) => Math.round(n * 10_000) / 10_000; // ~11 m : bien assez pour une distance en kilomètres

function defaultUserAgent() {
  const repo = process.env.GITHUB_REPOSITORY;
  return `cinema-data/1.0 (${repo ? `https://github.com/${repo}` : 'collecte des cinémas pour une application de films'})`;
}

/**
 * @returns geocode(address) -> { lat, lng, precision } | null ; lève GeocoderError si le service ne répond pas
 *          (réseau, refus, quota) : c'est à l'appelant de s'arrêter, ce n'est pas « adresse introuvable » (null).
 */
export function createNominatimGeocoder({
  fetchImpl = fetch,
  endpoint = process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org/search',
  userAgent = defaultUserAgent(),
  minGapMs = 1100,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = () => Date.now(),
} = {}) {
  let last = -Infinity;
  const pace = async () => {
    const wait = last + minGapMs - now();
    if (wait > 0) await sleep(wait);
    last = now();
  };

  async function search(q, country) {
    await pace();
    const inArea = AREAS[country] ?? inBelgiumLuxembourg;
    const params = new URLSearchParams({ q, format: 'jsonv2', limit: '1', countrycodes: country, 'accept-language': 'fr' });
    let res;
    try {
      res = await fetchImpl(`${endpoint}?${params}`, {
        headers: { 'User-Agent': userAgent, Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (e) {
      throw new GeocoderError(`réseau : ${e.message}`);
    }
    if (!res.ok) throw new GeocoderError(`HTTP ${res.status}`);
    let rows;
    try { rows = await res.json(); } catch { throw new GeocoderError('réponse illisible'); }
    const hit = Array.isArray(rows) ? rows[0] : null;
    const lat = Number(hit?.lat);
    const lng = Number(hit?.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) && inArea(lat, lng) ? { lat, lng } : null;
  }

  return async function geocode(address) {
    const country = countryOf(address);
    for (const { q, precision } of geocodeQueries(address)) {
      const hit = await search(q, country);
      if (hit) return { lat: round4(hit.lat), lng: round4(hit.lng), precision };
    }
    return null;
  };
}
