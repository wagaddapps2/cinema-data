/**
 * Solution de repli : elCinema (elcinema.com) pour les pays SANS site de cinéma officiel branché ici.
 * Il liste des films (pas des salles) : « à l'affiche » par pays (/en/now/<cc>/) et « bientôt » par région
 * (/en/soon/<région>/), 15 films par page. Un « cinéma » virtuel est créé par pays.
 */
const BASE = 'https://elcinema.com';

export const COUNTRIES = {
  eg: 'Egypt', ae: 'United Arab Emirates', sa: 'Saudi Arabia', qa: 'Qatar', bh: 'Bahrain', om: 'Oman',
  lb: 'Lebanon', jo: 'Jordan', sy: 'Syria', iq: 'Iraq', ma: 'Morocco', tn: 'Tunisia',
};
/** elCinema n'a pas de page « bientôt » par pays, seulement par région : on rattache chaque pays à la sienne. */
export const SOON_REGION = { eg: 'eg', ae: 'gulf', sa: 'gulf', qa: 'gulf', bh: 'gulf', om: 'gulf', lb: 'sham', jo: 'sham', sy: 'sham', iq: 'mena', ma: 'mena', tn: 'mena' };

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
export function parseDate(text) {
  const m = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(text ?? '');
  const mo = m && MONTHS[m[2].toLowerCase()];
  return m && mo ? `${m[3]}-${String(mo).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

export function parseElcinema(html, status) {
  return [...html.matchAll(/<div class="row" id="w(\d+)">([\s\S]*?)(?=<div class="row" id="w\d+">|<\/body>|$)/g)].map((m) => {
    const title = decode(/<h3><a href="\/en\/work\/\d+\/">([^<]*)<\/a>/.exec(m[2])?.[1] ?? '');
    // « <strong>Release Date:</strong> <a>8 October</a> <a>2026</a> » : jour+mois et année sont dans deux liens.
    const dateHtml = /Release Date:<\/strong>([\s\S]*?)<\/ul>/.exec(m[2])?.[1] ?? '';
    const date = parseDate(decode(dateHtml.replace(/<[^>]+>/g, ' ')));
    return { slug: m[1], title, releaseDate: date, status };
  }).filter((f) => f.title);
}

export function lastPage(html) {
  return Math.max(1, ...[...html.matchAll(/[?&](?:amp;)?page=(\d+)/g)].map((m) => Number(m[1])));
}

async function getPage(path) {
  const res = await fetch(BASE + path, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; cinema-data/1.0)', 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error(`elCinema ${path} -> ${res.status}`);
  return res.text();
}

async function allPages(path, status, maxPages = 6) {
  const first = await getPage(path);
  const films = parseElcinema(first, status);
  for (let p = 2; p <= Math.min(lastPage(first), maxPages); p++) {
    films.push(...parseElcinema(await getPage(`${path}?page=${p}`), status));
  }
  return films;
}

/** Pays -> { 'elcinema-<cc>': { name, films } }. Échoue seulement si « à l'affiche » est vide. */
export async function fetchElcinemaCountry(cc) {
  const now = await allPages(`/en/now/${cc}/`, 'now_showing');
  if (now.length === 0) throw new Error(`elCinema ${cc} : aucun film`);
  let soon = [];
  try { soon = await allPages(`/en/soon/${SOON_REGION[cc]}/`, 'coming_soon'); } catch { /* « bientôt » est un plus */ }
  const seen = new Set(now.map((f) => f.slug));
  const films = [...now, ...soon.filter((f) => !seen.has(f.slug))].map((f) => ({
    slug: f.slug, title: f.title, rating: '', language: '', releaseDate: f.releaseDate, url: `${BASE}/en/work/${f.slug}/`, status: f.status,
  }));
  return { [`elcinema-${cc}`]: { name: `Cinemas in ${COUNTRIES[cc]}`, films } };
}
