/**
 * Lecture de la page d'accueil d'Ozone Cinemas (Koweït) : onglets « Now Showing » (#pills-now) et
 * « Coming Soon » (#pills-coming). Chaque tuile porte data-location='["id",…]' (salles où le film passe)
 * et data-language / data-rating ; l'ordre des attributs varie d'une tuile à l'autre.
 */
const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const attr = (tag, name) => /* guillemets simples ou doubles */ new RegExp(`${name}=(?:"([^"]*)"|'([^']*)')`).exec(tag)?.slice(1).find((v) => v !== undefined) ?? '';

export function parseOzone(html) {
  const locations = {};
  for (const m of html.matchAll(/<option[^>]*value="(\d+)"[^>]*>\s*([^<]*)/g)) locations[m[1]] = decode(m[2]);

  const a = html.indexOf('id="pills-now"');
  const b = html.indexOf('id="pills-coming"');
  if (a < 0 || b < 0) return { locations, films: [] };

  const read = (segment, status) =>
    [...segment.matchAll(/<div class="[^"]*filmtile"([^>]*)>([\s\S]*?)(?=<div class="[^"]*filmtile"|$)/g)].map((m) => {
      const slug = /href="\/movies\/([^"/?#]+)"/.exec(m[2])?.[1] ?? '';
      const title = decode(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(m[2])?.[1] ?? '');
      let ids = [];
      try { ids = JSON.parse(attr(m[1], 'data-location') || '[]'); } catch { /* tuile sans salle */ }
      const rating = decode(attr(m[1], 'data-rating'));
      return { slug, title, language: decode(attr(m[1], 'data-language')), rating: rating === 'TBC' ? '' : rating, locationIds: ids, status };
    }).filter((f) => f.slug && f.title);

  return { locations, films: [...read(html.slice(a, b), 'now_showing'), ...read(html.slice(b), 'coming_soon')] };
}

export function ozoneToFeed(parsed, baseUrl) {
  const out = {};
  for (const [id, name] of Object.entries(parsed.locations)) {
    out[`ozone-${id}`] = {
      name: `Ozone Cinemas ${name}`,
      films: parsed.films
        .filter((f) => (f.status === 'coming_soon' && f.locationIds.length === 0) || f.locationIds.includes(id))
        .map((f) => ({ slug: f.slug, title: f.title, rating: f.rating, language: f.language, releaseDate: null, url: `${baseUrl}/movies/${f.slug}`, status: f.status })),
    };
  }
  return out;
}

export async function fetchOzone(baseUrl) {
  const res = await fetch(`${baseUrl}/`, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; cinema-data/1.0)' } });
  if (!res.ok) throw new Error(`Ozone -> ${res.status}`);
  return ozoneToFeed(parseOzone(await res.text()), baseUrl);
}
