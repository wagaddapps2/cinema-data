/**
 * Lecture des pages « What's on » et « Coming soon » de VOX Cinemas Kuwait.
 * Données minimales (titre, langue, classification, date de sortie, lien) : ni affiches, ni synopsis.
 * Les fonctions parse* sont pures (HTML -> objets) pour être testées sur des pages enregistrées.
 */
const BASE = 'https://kwt.voxcinemas.com';

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const attr = (tag, name) => decode(new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1] ?? '');
const slugOf = (href) => /\/movies\/([^/?#"]+)/.exec(href)?.[1] ?? '';

function cards(html) {
  return [...html.matchAll(/<article\s+class="movie-summary"[^>]*>[\s\S]*?<\/article>/g)].map((m) => m[0]);
}

function movieUrl(slug) {
  return `${BASE}/movies/${slug}`;
}

/** Films à l'affiche. */
export function parseWhatsOn(html) {
  return cards(html).map((c) => ({
    slug: attr(c, 'data-slug'),
    title: attr(c, 'data-title'),
    rating: decode(/class="classification[^"]*"\s*>([^<]*)</.exec(c)?.[1] ?? ''),
    language: decode(/<strong>Language:<\/strong>\s*([^<]*)</.exec(c)?.[1] ?? ''),
    url: movieUrl(attr(c, 'data-slug')),
    status: 'now_showing',
  })).filter((m) => m.slug && m.title);
}

const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

/** "15 October 2026" -> "2026-10-15" ; null si illisible. */
export function parseReleaseDate(text) {
  const m = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(text ?? '');
  const mo = m && MONTHS[m[2].toLowerCase()];
  return m && mo ? `${m[3]}-${String(mo).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

/** Films à venir. */
export function parseComingSoon(html) {
  return cards(html).map((c) => {
    const slug = attr(c, 'data-slug');
    const h3 = /<h3>([\s\S]*?)<\/h3>/.exec(c)?.[1] ?? '';
    return {
      slug,
      title: attr(c, 'data-title'),
      rating: decode(/class="classification[^"]*"\s*>([^<]*)</.exec(h3)?.[1] ?? ''),
      language: decode(/<strong>Language:<\/strong>\s*([^<]*)/.exec(c)?.[1] ?? ''),
      releaseDate: parseReleaseDate(/<strong>Release Date:<\/strong>\s*([^<]*)/.exec(c)?.[1]),
      url: movieUrl(slug),
      status: 'coming_soon',
    };
  }).filter((m) => m.slug && m.title);
}

async function get(path) {
  const res = await fetch(BASE + path, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; cinema-data/1.0)' } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.text();
}

export async function fetchVox() {
  const [now, soon] = await Promise.all([get('/movies/whatson'), get('/movies/comingsoon')]);
  return { cinema: 'vox-kw', whatsOn: parseWhatsOn(now), comingSoon: parseComingSoon(soon) };
}
