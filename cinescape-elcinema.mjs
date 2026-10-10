/**
 * Cinescape Kuwait via elCinema : le site officiel de Cinescape bloque les accès automatiques (Cloudflare),
 * mais elCinema a une page par salle avec ses films à l'affiche. Seuls les TITRES sont gardés (ni horaires, ni notes).
 */
const BASE = 'https://elcinema.com';

/** Identifiants des pages de salles sur elCinema (liste du Koweït : /en/theater/3/). */
export const CINESCAPE_BRANCHES = {
  '3101210': 'Cinescape Avenues',
  '3101202': 'Cinescape 360',
  '3101206': 'Cinescape Ajial',
  '3101208': 'Cinescape Al Kout',
  '3101460': 'Cinescape Assima',
  '3101339': 'Cinescape 1954 Film House',
  '3101203': 'Cinescape Al-Bairaq',
};

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export function parseTheater(html) {
  const seen = new Set();
  const films = [];
  for (const m of html.matchAll(/<h3>\s*<a href="\/en\/work\/(\d+)\/">([^<]*)<\/a>/g)) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    const title = decode(m[2]);
    if (title) films.push({ slug: m[1], title });
  }
  return films;
}

export function theaterToFilms(parsed) {
  return parsed.map((f) => ({ slug: f.slug, title: f.title, rating: '', language: '', releaseDate: null, url: `${BASE}/en/work/${f.slug}/`, status: 'now_showing' }));
}

async function getHtml(id) {
  const res = await fetch(`${BASE}/en/theater/${id}/`, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; cinema-data/1.0)', 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error(`elCinema theater ${id} -> ${res.status}`);
  return res.text();
}

/** Une salle en échec n'empêche pas les autres ; l'ensemble échoue seulement si AUCUNE salle n'a de film. */
export async function fetchCinescapeViaElcinema(get = getHtml) {
  const out = {};
  for (const [id, name] of Object.entries(CINESCAPE_BRANCHES)) {
    try {
      const films = theaterToFilms(parseTheater(await get(id)));
      if (films.length > 0) out[`cinescape-${id}`] = { name, films };
    } catch (e) {
      console.warn(`::warning::cinescape ${name} : ${e.message}`);
    }
  }
  if (Object.keys(out).length === 0) throw new Error('Cinescape (elCinema) : aucune salle lue');
  return out;
}
