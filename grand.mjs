/**
 * Lecture de la page d'accueil de Grand Cinemas Kuwait : onglets « Showing Now » (#movies_1) et
 * « Coming Soon » (#movies_2), et la liste des cinémas (filterpercinema('4','Grand AL ANDALUS')).
 * Chaque film porte data-cinemas="…,1,1,4,4" : les identifiants de cinémas de ses séances (répétés).
 * Aucune heure n'est lue ni conservée.
 */
const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** "Grand AL ANDALUS" -> "Grand Al Andalus" */
const nice = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

export function parseGrandCinemas(html) {
  const cinemas = {};
  for (const m of html.matchAll(/filterpercinema\('(\d+)','([^']+)'\)/g)) cinemas[m[1]] = nice(decode(m[2]));

  const a = html.indexOf('id="movies_1"');
  const b = html.indexOf('id="movies_2"');
  if (a < 0 || b < 0) return { cinemas, films: [] };

  const read = (segment, status) =>
    segment.split('<div class="movie col').slice(1).map((chunk) => {
      const slug = /href="\/movie\/([^/"]+)\/en"/.exec(chunk)?.[1] ?? '';
      const title = decode(/movie-hover-title[^>]*>([^<]*)</.exec(chunk)?.[1] ?? '');
      const rating = decode(/class="overlaycircle"[^>]*>\s*([^<]*)</.exec(chunk)?.[1] ?? '');
      const genreLine = decode(/movie-hover-genre[^>]*>([^<]*)</.exec(chunk)?.[1] ?? '');
      const ids = [...new Set((/data-cinemas="([^"]*)"/.exec(chunk)?.[1] ?? '').split(',').filter(Boolean))];
      return { slug, title, rating: rating === 'TBC' ? '' : rating, genres: genreLine.split('|')[0]?.trim() ?? '', cinemaIds: ids, status };
    }).filter((f) => f.slug && f.title);

  return { cinemas, films: [...read(html.slice(a, b), 'now_showing'), ...read(html.slice(b), 'coming_soon')] };
}

/** Un « cinéma » par salle, dans le format de kuwait.json. */
export function grandToFeed(parsed, baseUrl) {
  const out = {};
  for (const [id, name] of Object.entries(parsed.cinemas)) {
    out[`grand-${id}`] = {
      name,
      films: parsed.films
        // « À venir » n'a pas de salle : on le rattache à toutes les salles du réseau.
        .filter((f) => (f.status === 'coming_soon' ? true : f.cinemaIds.includes(id)))
        .map((f) => ({ slug: f.slug, title: f.title, rating: f.rating, language: '', releaseDate: null, url: `${baseUrl}/movie/${f.slug}/en`, status: f.status })),
    };
  }
  return out;
}

export async function fetchGrand(baseUrl) {
  const res = await fetch(`${baseUrl}/en`, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; cinema-data/1.0)' } });
  if (!res.ok) throw new Error(`Grand Cinemas -> ${res.status}`);
  return grandToFeed(parseGrandCinemas(await res.text()), baseUrl);
}
