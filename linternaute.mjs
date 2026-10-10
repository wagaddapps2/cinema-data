/**
 * France via Linternaute (linternaute.com/cinema/seances) : le site est organisé par département > ville >
 * arrondissement. On lit un jeu de GRANDES VILLES ; pour celles qui ont des arrondissements (Paris, Marseille, Lyon),
 * les pages d'arrondissement contiennent bien plus de films que la page de la ville, donc on les lit aussi.
 * Un seul « cinéma » virtuel couvre le pays ; le lien mène à la fiche du film sur Linternaute (séances par ville).
 * Seuls titres et liens sont gardés : ni horaires, ni affiches.
 */
const BASE = 'https://www.linternaute.com';

/** { département (slug du site), ville (slug) } : les identifiants sont retrouvés sur le site, jamais codés en dur. */
export const FR_CITIES = [
  { dep: 'paris', city: 'paris' },
  { dep: 'bouches-du-rhone', city: 'marseille' },
  { dep: 'rhone', city: 'lyon' },
  { dep: 'haute-garonne', city: 'toulouse' },
  { dep: 'alpes-maritimes', city: 'nice' },
  { dep: 'loire-atlantique', city: 'nantes' },
  { dep: 'herault', city: 'montpellier' },
  { dep: 'bas-rhin', city: 'strasbourg' },
  { dep: 'gironde', city: 'bordeaux' },
  { dep: 'nord', city: 'lille' },
  { dep: 'ille-et-vilaine', city: 'rennes' },
];

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** Films d'une page de séances. */
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

export const arrondissementPaths = (html) => [...new Set([...html.matchAll(/href="(?:https:\/\/www\.linternaute\.com)?(\/cinema\/seances\/arrondissement\/\d+\/[^"#/]+\/)"/g)].map((m) => m[1]))];
export const departmentPath = (hubHtml, dep) => new RegExp(`href="(?:https://www\\.linternaute\\.com)?(/cinema/seances/departement/\\d+/${dep}/)"`).exec(hubHtml)?.[1] ?? null;
export const cityPath = (depHtml, city) => new RegExp(`href="(?:https://www\\.linternaute\\.com)?(/cinema/seances/ville/\\d+/${city}/)"`).exec(depHtml)?.[1] ?? null;

export function franceToFeed(films) {
  return {
    'linternaute-fr': {
      name: 'Cinemas in France (Linternaute)',
      films: films.map((f) => ({ slug: f.slug, title: f.title, rating: '', language: '', releaseDate: null, url: f.url, status: 'now_showing' })),
    },
  };
}

async function getHtml(path) {
  const res = await fetch(BASE + path, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; cinema-data/1.0)', 'Accept-Language': 'fr' } });
  if (!res.ok) throw new Error(`Linternaute ${path} -> ${res.status}`);
  return res.text();
}

export async function fetchLinternaute(get = getHtml, cities = FR_CITIES, pauseMs = 300) {
  const pause = () => (pauseMs ? new Promise((r) => setTimeout(r, pauseMs)) : Promise.resolve());
  const films = new Map();
  const add = (html) => { for (const f of parseFilms(html)) if (!films.has(f.slug)) films.set(f.slug, f); };
  const hub = await get('/cinema/seances/');
  for (const { dep, city } of cities) {
    try {
      const depPath = departmentPath(hub, dep);
      if (!depPath) throw new Error(`département « ${dep} » introuvable`);
      await pause();
      const path = cityPath(await get(depPath), city);
      if (!path) throw new Error(`ville « ${city} » introuvable`);
      await pause();
      const cityHtml = await get(path);
      add(cityHtml);
      for (const arr of arrondissementPaths(cityHtml)) {
        await pause();
        try { add(await get(arr)); } catch (e) { console.warn(`::warning::linternaute ${arr} : ${e.message}`); }
      }
    } catch (e) {
      console.warn(`::warning::linternaute ${city} : ${e.message}`);
    }
  }
  if (films.size === 0) throw new Error('Linternaute : aucun film lu');
  return franceToFeed([...films.values()]);
}
