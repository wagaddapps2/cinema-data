/**
 * Cinebel (cinebel.dhnet.be, La DH) : « Films à l'affiche » en Belgique, 10 films par page (?page=N).
 * Un seul « cinéma » virtuel couvre le pays : le lien mène à la fiche Cinebel du film, qui liste toutes les salles.
 * On garde le titre français ET le titre original (entre parenthèses) pour la correspondance avec TMDB.
 */
const BASE = 'https://cinebel.dhnet.be';

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** "07/10/2026" -> "2026-10-07" */
export function parseFrDate(text) {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text ?? '');
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

export function parseCinebel(html, today = new Date().toISOString().slice(0, 10)) {
  return [...html.matchAll(/<div id="movie\d+" class="subSection[^"]*">([\s\S]*?)(?=<div id="movie\d+" class="subSection[^"]*">|<ul class="pager|$)/g)].map((m) => {
    const a = /<h2>\s*<a href="\s*(\/film\/(\d+)\/[^"]*?)\s*">([\s\S]*?)<\/a>/.exec(m[1]);
    if (!a) return null;
    const original = /<span[^>]*class="originalTitle"[^>]*>\s*\(([^)]*)\)/.exec(a[3])?.[1];
    // Le titre est dans un <span> simple ; le titre original, dans un <span class="originalTitle"> qu'on retire.
    const title = decode(a[3].replace(/<span[^>]*class="originalTitle"[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, ' '));
    const releaseDate = parseFrDate(/class="releaseDate"[\s\S]*?<\/span>/.exec(m[1])?.[0]);
    return {
      slug: a[2], title, originalTitle: original ? decode(original) : '',
      releaseDate, path: a[1].replace(/ /g, '%20'),
      status: releaseDate && releaseDate > today ? 'coming_soon' : 'now_showing',
    };
  }).filter((f) => f && f.title);
}

export function lastPage(html) {
  return Math.max(1, ...[...html.matchAll(/\?page=(\d+)/g)].map((m) => Number(m[1])));
}

export function cinebelToFeed(films) {
  return {
    'cinebel-be': {
      name: 'Cinemas in Belgium (Cinebel)',
      films: films.map((f) => ({ slug: f.slug, title: f.title, originalTitle: f.originalTitle, rating: '', language: '', releaseDate: f.releaseDate, url: BASE + f.path, status: f.status })),
    },
  };
}

async function getPage(page) {
  const res = await fetch(`${BASE}/films${page > 1 ? `?page=${page}` : ''}`, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; cinema-data/1.0)', 'Accept-Language': 'fr' } });
  if (!res.ok) throw new Error(`Cinebel page ${page} -> ${res.status}`);
  return res.text();
}

export async function fetchCinebel(get = getPage, maxPages = 40, pauseMs = 250) {
  const first = await get(1);
  const films = parseCinebel(first);
  for (let p = 2; p <= Math.min(lastPage(first), maxPages); p++) {
    if (pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
    try { films.push(...parseCinebel(await get(p))); } catch (e) { console.warn(`::warning::cinebel page ${p} : ${e.message}`); }
  }
  if (films.length === 0) throw new Error('Cinebel : aucun film lu');
  const seen = new Set();
  return cinebelToFeed(films.filter((f) => !seen.has(f.slug) && seen.add(f.slug)));
}
