/**
 * France via Linternaute (linternaute.com/cinema/seances) : une entrée par VRAIE salle des grandes villes, avec sa ville,
 * son adresse et sa position — comme la Belgique. L'app peut alors filtrer par ville et trier les salles par distance.
 *
 * Le site est organisé par département > ville. La page d'une ville liste ses salles deux par deux (?page=N) : pour
 * chacune, son nom, son adresse et les films qu'elle joue (versions VF / VO). On lit ces pages pour un jeu de GRANDES
 * VILLES ; `city` est le nom de la grande ville (« Paris »), qui sert de filtre dans l'app. Seuls titres, versions et
 * liens sont gardés : ni horaires, ni affiches.
 *
 * Une salle absente de cette collecte (page illisible) garde ses données précédentes trois jours au plus. Si aucune salle
 * n'est lisible (le site a changé), on revient à la liste nationale : une seule entrée « tout le pays ».
 */
import { restoredCinema } from './cinebel.mjs';

const BASE = 'https://www.linternaute.com';

/** { département (slug du site), ville (slug), nom affiché } : les identifiants sont retrouvés sur le site, jamais codés en dur. */
export const FR_CITIES = [
  { dep: 'paris', city: 'paris', label: 'Paris' },
  { dep: 'bouches-du-rhone', city: 'marseille', label: 'Marseille' },
  { dep: 'rhone', city: 'lyon', label: 'Lyon' },
  { dep: 'haute-garonne', city: 'toulouse', label: 'Toulouse' },
  { dep: 'alpes-maritimes', city: 'nice', label: 'Nice' },
  { dep: 'loire-atlantique', city: 'nantes', label: 'Nantes' },
  { dep: 'herault', city: 'montpellier', label: 'Montpellier' },
  { dep: 'bas-rhin', city: 'strasbourg', label: 'Strasbourg' },
  { dep: 'gironde', city: 'bordeaux', label: 'Bordeaux' },
  { dep: 'nord', city: 'lille', label: 'Lille' },
  { dep: 'ille-et-vilaine', city: 'rennes', label: 'Rennes' },
];

/** Clé de l'entrée nationale (repli quand aucune salle n'est lisible). */
export const NATIONAL_KEY = 'linternaute-fr';

/** Pages d'une ville lues au plus (Paris en compte une quarantaine, deux salles par page). */
const MAX_PAGES = 60;

/**
 * Grandes chaînes françaises : l'app regroupe leurs salles (« UGC · 6 cinemas »). Les autres salles sont indépendantes.
 * Comparaison sans casse ni accents : « mk2 Bibliothèque », « Pathe Wepler ».
 */
export const FR_CHAINS = ['UGC', 'Pathé', 'Gaumont', 'CGR', 'MK2', 'Mégarama', 'Kinepolis', 'Cinéville'];
const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const brandOfFrenchCinema = (name) => FR_CHAINS.find((c) => fold(name).startsWith(`${fold(c)} `)) ?? '';

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const stripTags = (s) => s.replace(/<[^>]+>/g, ' ');

/** Date du jour en France (AAAA-MM-JJ) : la collecte tourne en UTC. */
export function todayInFrance(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Films d'une page (ou d'une partie de page) de séances. */
export function parseFilms(html) {
  const out = [];
  const seen = new Set();
  for (const m of html.matchAll(/<div class="jMovie movie" data-movieId="(\d+)">([\s\S]*?)(?=<div class="jMovie movie"|<\/body>|$)/g)) {
    const link = /<a class="movie_title" href="(https:\/\/www\.linternaute\.com\/cinema\/tous-les-films\/[^"]+)">([^<]*)<\/a>/.exec(m[2]);
    const title = link ? decode(link[2]) : '';
    if (title && !seen.has(m[1])) { seen.add(m[1]); out.push({ slug: m[1], title, url: link[1] }); }
  }
  return out;
}

/** « PARIS » -> « Paris », « AIX-EN-PROVENCE » -> « Aix-en-Provence » (les petits mots restent en minuscules). */
const SMALL_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'en', 'sur', 'sous', 'lès', 'et', 'aux', 'au']);
export function cityCase(text) {
  return String(text ?? '')
    .toLowerCase()
    .split(/([\s-]+)/)
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
}

/**
 * Adresse d'une salle (contenu de sa balise <address>, sans le nom) : « 54 Rue de Chanterac - 13001 MARSEILLE ».
 * Le code postal est le dernier nombre à cinq chiffres précédé d'un tiret (la rue peut en contenir : « niveau - 3 »).
 */
export function parseFrAddress(inner) {
  const text = decode(stripTags(String(inner ?? '').replace(/<h2[\s\S]*?<\/h2>/g, ' ')));
  const m = /^(.*)\s+-\s+(\d{5})\s+(\S.*)$/.exec(text) ?? /^(.*?)[\s,]+(\d{5})\s+(\S.*)$/.exec(text);
  if (!m) return null;
  return { street: m[1].replace(/[\s,-]+$/, '').trim(), postalCode: m[2], city: cityCase(m[3].trim()), country: 'fr' };
}

/** « 54 Rue de Chanterac, 13001 Marseille » : sert aussi à reconnaître une salle dont l'adresse n'a pas changé. */
export const frAddressText = (a) => [a.street, `${a.postalCode} ${a.city}`].filter(Boolean).join(', ');

/** « En VF », « En 3DVF » -> VF ; « En VO », « En VOSTFR » -> VO. */
function versionOf(diffusion) {
  const d = String(diffusion ?? '').toUpperCase();
  if (d.includes('VO')) return 'VO';
  if (d.includes('VF')) return 'VF';
  return '';
}
const VERSION_ORDER = ['VF', 'VO'];
const byVersion = (a, b) => VERSION_ORDER.indexOf(a) - VERSION_ORDER.indexOf(b);

/**
 * Les salles d'une page de ville (deux par page) : identifiant, nom, adresse, et les films qu'elle joue avec leurs
 * versions. Une salle sans lien vers sa page n'est pas une salle (rien d'autre ne permet de la reconnaître).
 */
export function parseCinemaSections(html) {
  const out = [];
  for (const part of String(html ?? '').split('<div class="cinema_header">').slice(1)) {
    const link = /class="jCinemaLink" href="(?:https:\/\/www\.linternaute\.com)?\/cinema\/seances\/cinema\/(\d+)\/([^"/]+)\/"\s*>([\s\S]*?)<\/a>/.exec(part);
    if (!link) continue;
    const name = decode(stripTags(link[3]));
    if (!name) continue;
    const versions = new Map();
    for (const m of part.matchAll(/<div class="showtimes" data-diffusion="([^"]*)" data-movieId="(\d+)"/g)) {
      const v = versionOf(m[1]);
      if (!v) continue;
      if (!versions.has(m[2])) versions.set(m[2], new Set());
      versions.get(m[2]).add(v);
    }
    const films = parseFilms(part).map((f) => ({ ...f, versions: [...(versions.get(f.slug) ?? [])].sort(byVersion) }));
    out.push({ id: link[1], slug: link[2], name, address: parseFrAddress(/<address>([\s\S]*?)<\/address>/.exec(part)?.[1]), films });
  }
  return out;
}

/** Dernière page de la liste des salles d'une ville (« ?page=40 » dans la pagination), 1 sans pagination. */
export function lastPage(html) {
  return Math.max(1, ...[...String(html ?? '').matchAll(/\?page=(\d+)/g)].map((m) => Number(m[1])));
}

export const arrondissementPaths = (html) => [...new Set([...html.matchAll(/href="(?:https:\/\/www\.linternaute\.com)?(\/cinema\/seances\/arrondissement\/\d+\/[^"#/]+\/)"/g)].map((m) => m[1]))];
export const departmentPath = (hubHtml, dep) => new RegExp(`href="(?:https://www\\.linternaute\\.com)?(/cinema/seances/departement/\\d+/${dep}/)"`).exec(hubHtml)?.[1] ?? null;
export const cityPath = (depHtml, city) => new RegExp(`href="(?:https://www\\.linternaute\\.com)?(/cinema/seances/ville/\\d+/${city}/)"`).exec(depHtml)?.[1] ?? null;

/** Une entrée par salle qui joue au moins un film. */
export function cinemasToFeed(cinemas, today = todayInFrance()) {
  const out = {};
  for (const c of cinemas) {
    if (c.films.length === 0) continue;
    out[`linternaute-${c.id}`] = {
      name: c.name,
      city: c.city,
      brand: brandOfFrenchCinema(c.name),
      // Adresse et coordonnées : l'app trie les salles par distance (lat/lng absents = salle pas encore localisée).
      ...(c.address ? { address: frAddressText(c.address) } : {}),
      ...(Number.isFinite(c.lat) && Number.isFinite(c.lng) ? { lat: c.lat, lng: c.lng } : {}),
      // Date de lecture : une salle illisible ensuite garde ces données quelques jours seulement.
      fetchedAt: today,
      films: c.films.map((f) => ({
        slug: f.slug,
        title: f.title,
        rating: '',
        language: f.versions.join('/'),
        releaseDate: null,
        url: f.url,
        status: 'now_showing',
      })),
    };
  }
  return out;
}

/** Repli : tous les films lus en une seule entrée « tout le pays » (l'app n'affiche jamais le nom de la source). */
export function franceToFeed(films) {
  return {
    [NATIONAL_KEY]: {
      name: 'Cinemas in France (Linternaute)',
      films: films.map((f) => ({ slug: f.slug, title: f.title, rating: '', language: '', releaseDate: null, url: f.url, status: 'now_showing' })),
    },
  };
}

/** L'entrée nationale d'une collecte précédente (sans date de lecture) : gardée telle quelle en cas de panne complète. */
export const isNationalEntry = (entry) => /^cinemas in france\b/i.test(String(entry?.name ?? ''));

/**
 * Coordonnées des salles qui ont des films : reprises du dernier fichier tant que l'adresse n'a pas changé, sinon
 * cherchées auprès du géocodeur — une seule fois par salle. Après 3 échecs de suite (blocage, quota), le géocodeur est
 * laissé tranquille jusqu'à la collecte suivante. Une salle sans coordonnées reste publiée, sans distance.
 * @param geocode adresse -> { lat, lng } | null (null : introuvable ; lève : service indisponible) ; absent : pas de recherche
 */
export async function locateCinemas(cinemas, previous, geocode, warn = console.warn) {
  let reused = 0;
  let found = 0;
  let missing = 0;
  let failures = 0;
  for (const c of cinemas) {
    if (c.films.length === 0 || !c.address) continue;
    const old = previous[`linternaute-${c.id}`];
    if (old?.address === frAddressText(c.address) && Number.isFinite(old.lat) && Number.isFinite(old.lng)) {
      c.lat = old.lat;
      c.lng = old.lng;
      reused++;
      continue;
    }
    if (!geocode || failures >= 3) { missing++; continue; }
    try {
      const hit = await geocode(c.address);
      failures = 0;
      if (hit) { c.lat = hit.lat; c.lng = hit.lng; found++; } else missing++;
    } catch (e) {
      failures++;
      missing++;
      warn(`::warning::linternaute : coordonnées de la salle ${c.id} (${c.name}) : ${e.message}${failures >= 3 ? ' — recherche suspendue jusqu\'à la prochaine collecte' : ''}`);
    }
  }
  console.log(`linternaute : coordonnées des salles — ${reused} reprise(s), ${found} trouvée(s), ${missing} manquante(s)`);
  return { reused, found, missing };
}

async function getHtml(path) {
  // Délai court : une page bloquée ne doit pas faire durer la collecte (Node attend sinon plusieurs minutes).
  const res = await fetch(BASE + path, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; cinema-data/1.0)', 'Accept-Language': 'fr' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Linternaute ${path} -> ${res.status}`);
  return res.text();
}

/**
 * @param get      lecteur de page (chemin -> HTML), remplacé dans les tests
 * @param previous entrées du dernier fichier publié : une salle absente cette fois garde les siennes (3 jours au plus)
 * @param geocode  adresse -> { lat, lng } | null, pour localiser les salles ; absent : aucune recherche (les tests)
 */
export async function fetchLinternaute(get = getHtml, { cities = FR_CITIES, pauseMs = 300, maxPages = MAX_PAGES, previous = {}, geocode, today = todayInFrance(), warn = console.warn } = {}) {
  const pause = () => (pauseMs ? new Promise((r) => setTimeout(r, pauseMs)) : Promise.resolve());
  const cinemas = new Map(); // identifiant -> salle (et sa grande ville)
  const national = new Map(); // tous les films lus, pour le repli
  const take = (html, label) => {
    for (const f of parseFilms(html)) if (!national.has(f.slug)) national.set(f.slug, f);
    for (const c of parseCinemaSections(html)) if (!cinemas.has(c.id)) cinemas.set(c.id, { ...c, city: label });
  };

  const hub = await get('/cinema/seances/');
  for (const { dep, city, label } of cities) {
    try {
      const depPath = departmentPath(hub, dep);
      if (!depPath) throw new Error(`département « ${dep} » introuvable`);
      await pause();
      const path = cityPath(await get(depPath), city);
      if (!path) throw new Error(`ville « ${city} » introuvable`);
      await pause();
      const first = await get(path);
      take(first, label ?? cityCase(city));
      const last = Math.min(lastPage(first), maxPages);
      for (let p = 2; p <= last; p++) {
        await pause();
        try { take(await get(`${path}?page=${p}`), label ?? cityCase(city)); } catch (e) { warn(`::warning::linternaute ${city} page ${p} : ${e.message}`); }
      }
    } catch (e) {
      warn(`::warning::linternaute ${city} : ${e.message}`);
    }
  }

  const list = [...cinemas.values()];
  if (list.length === 0) {
    // Plus aucune salle reconnue (le site a changé) : la liste nationale, comme avant, plutôt que rien.
    if (national.size === 0) throw new Error('Linternaute : aucun film lu');
    warn(`::warning::linternaute : aucune salle reconnue — liste nationale (${national.size} films)`);
    return franceToFeed([...national.values()]);
  }

  await locateCinemas(list, previous, geocode, warn);
  const feed = cinemasToFeed(list, today);
  // Une salle absente cette fois (page illisible) garde ses données précédentes, trois jours au plus.
  let restored = 0;
  for (const [key, entry] of Object.entries(previous)) {
    if (!key.startsWith('linternaute-') || key === NATIONAL_KEY || feed[key]) continue;
    const kept = restoredCinema(entry, today);
    if (kept) { feed[key] = kept; restored++; }
  }
  console.log(`linternaute : ${Object.keys(feed).length - restored} salle(s) lue(s), ${restored} reprise(s) de la collecte précédente`);
  return feed;
}
