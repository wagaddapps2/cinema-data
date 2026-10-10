/**
 * Lecture de la page d'accueil de SKY Cinemas Koweït (Salmiya) : onglets #now-showing et #coming-soon
 * (l'onglet VIP est ignoré). Une seule salle. Les liens des films : /movie-information/<slug>/<id>.
 */
const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const LANGS = 'ARABIC|ENGLISH|HINDI|TELUGU|TAMIL|MALAYALAM|KOREAN|TAGALOG|FRENCH|TURKISH|URDU|JAPANESE|FILIPINO';
/** "MATLOUB AAELEYAN (EGYPTIAN) - ARABIC" -> "MATLOUB AAELEYAN" : le suffixe de langue gêne la correspondance TMDB. */
export function cleanTitle(t) {
  return decode(t).replace(new RegExp(`\\s*-\\s*(?:${LANGS})(?:\\s*\\([^)]*\\))?\\s*$`, 'i'), '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function parseSky(html) {
  const a = html.indexOf('id="now-showing"');
  const b = html.indexOf('id="coming-soon"');
  const c = html.indexOf('id="vip"');
  if (a < 0 || b < 0) return [];
  const read = (segment, status) =>
    segment.split("<section class='nowshowing'>").slice(1).map((chunk) => {
      const rawTitle = /class='moviename' title='([^']*)'/.exec(chunk)?.[1] ?? /alt='([^']*)'/.exec(chunk)?.[1] ?? '';
      const link = /href='\/movie-information\/(?!date-time)([^/']+)\/(\d+)/.exec(chunk);
      const spans = [...chunk.matchAll(/<ul class='triler-detail'><li><span>([^<]*)<\/span>[\s\S]*?<span>([^<]*)<\/span>/g)][0];
      return {
        slug: link ? `${link[1]}/${link[2]}` : '',
        title: cleanTitle(rawTitle),
        language: decode(spans?.[1] ?? ''),
        status,
      };
    }).filter((f) => f.slug && f.title);
  return [...read(html.slice(a, b), 'now_showing'), ...read(html.slice(b, c > b ? c : undefined), 'coming_soon')];
}

export function skyToFeed(films, baseUrl) {
  return {
    'sky-salmiya': {
      name: 'SKY Cinemas Salmiya',
      films: films.map((f) => ({ slug: f.slug, title: f.title, rating: '', language: f.language, releaseDate: null, url: `${baseUrl}/movie-information/${f.slug}`, status: f.status })),
    },
  };
}

export async function fetchSky(baseUrl) {
  const res = await fetch(`${baseUrl}/`, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; cinema-data/1.0)' } });
  if (!res.ok) throw new Error(`SKY -> ${res.status}`);
  return skyToFeed(parseSky(await res.text()), baseUrl);
}
