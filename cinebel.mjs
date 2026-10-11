/**
 * Belgique via Cinebel (cinebel.dhnet.be, La DH) : une entrée par VRAIE salle, avec sa ville.
 *
 *  1. « Films à l'affiche » (10 films par page, ?page=N) : titre français, titre original et date de sortie de chaque
 *     film. Sert à dater les films des salles et de repli si aucune page de salle n'est lisible.
 *  2. La liste des salles : le menu « Cinéma » (id="theaterSelector"), présent sur chaque page du site.
 *  3. La page de chaque salle (/cinema/<id>/<nom>) : les films qu'elle programme cette semaine.
 *
 * Seuls le titre, les versions (VF/VO/NV), l'âge conseillé et le statut sont gardés : aucun horaire.
 * Une salle momentanément illisible garde ses données de la collecte précédente (option `previous`), trois jours au plus.
 * Si moins de la moitié des salles sont connues, on ajoute la liste nationale (une entrée « tout le pays ») ; l'app ne
 * l'affiche que pour les films qu'aucune salle connue ne propose.
 */
const BASE = 'https://cinebel.dhnet.be';

/**
 * Vraies chaînes de Belgique : leurs salles sont regroupées par l'app (« Kinepolis · 4 cinemas »). Les autres salles
 * sont indépendantes, même si leur nom commence pareil (« Plaza Hotton » et « Plaza ArtHouse Cinema »).
 */
export const CHAINS = ['Kinepolis', 'UGC', 'Pathé', 'Imagix', 'CineXtra', 'Lumière'];
export const brandOfTheater = (name) => CHAINS.find((c) => name.startsWith(`${c} `)) ?? '';

/** Données d'une salle gardées au plus ce nombre de jours quand sa page reste illisible. */
const MAX_STALE_DAYS = 3;

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const stripTags = (s) => s.replace(/<[^>]+>/g, ' ');

/** Date du jour en Belgique (AAAA-MM-JJ) : la collecte tourne en UTC, mais les séances sont à l'heure belge. */
export function todayInBelgium(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** "07/10/2026" -> "2026-10-07" */
export function parseFrDate(text) {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text ?? '');
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

/** Films d'une page « Films à l'affiche ». */
export function parseCinebel(html, today = todayInBelgium()) {
  return [...html.matchAll(/<div id="movie\d+" class="subSection[^"]*">([\s\S]*?)(?=<div id="movie\d+" class="subSection[^"]*">|<ul class="pager|$)/g)].map((m) => {
    const a = /<h2>\s*<a href="\s*(\/film\/(\d+)\/[^"]*?)\s*">([\s\S]*?)<\/a>/.exec(m[1]);
    if (!a) return null;
    const original = /<span[^>]*class="originalTitle"[^>]*>\s*\(([^)]*)\)/.exec(a[3])?.[1];
    // Le titre est dans un <span> simple ; le titre original, dans un <span class="originalTitle"> qu'on retire.
    const title = decode(stripTags(a[3].replace(/<span[^>]*class="originalTitle"[\s\S]*?<\/span>/g, '')));
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

/** Salles de Belgique, d'après le menu « Cinéma » présent sur toutes les pages : [{ id, name }]. */
export function parseTheaters(html) {
  const select = /<select[^>]*id="theaterSelector"[^>]*>([\s\S]*?)<\/select>/.exec(html)?.[1] ?? '';
  const seen = new Set();
  return [...select.matchAll(/<option value="(\d+)"[^>]*>([\s\S]*?)<\/option>/g)]
    .map((m) => ({ id: m[1], name: decode(stripTags(m[2])) }))
    .filter((t) => t.name && !seen.has(t.id) && seen.add(t.id));
}

/** Ville d'une salle : la ligne « 1000&nbsp;Bruxelles » de son adresse (code postal belge, ou « L-1234 » au Luxembourg). */
export function parseCity(html) {
  const adr = /<p class="adress">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '';
  for (const line of adr.split(/<br\s*\/?>/i)) {
    const m = /^(?:[A-Z]-)?\d{4,5}\s+(.+)$/.exec(decode(stripTags(line)));
    if (m) return m[1];
  }
  return '';
}

/** « 11/10 » (jour/mois, sans année) -> AAAA-MM-JJ, avec l'année qui place la date au plus près d'aujourd'hui. */
export function dayMonthToIso(day, month, today) {
  const y = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));
  const m = Number(month);
  const year = m - thisMonth > 6 ? y - 1 : thisMonth - m > 6 ? y + 1 : y;
  return `${year}-${String(m).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`;
}

/** « À partir de 12 ans » -> « 12+ » ; « Tout public » -> « AL » (tous âges, comme sur Cinecheck). */
export function audienceLabel(alt) {
  const age = /(\d+)\s*ans/i.exec(alt ?? '')?.[1];
  if (age) return `${age}+`;
  return /\btou[st]s?\s+publics?\b|enfants admis/i.test(alt ?? '') ? 'AL' : '';
}

/** VF = version française, VO = originale (sous-titrée), NV = néerlandaise (« Nederlandse versie »). */
const VERSION_ORDER = ['VF', 'VO', 'NV'];
const byVersion = (a, b) => (VERSION_ORDER.indexOf(a) + 1 || 99) - (VERSION_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b);

/**
 * Vraie page de salle ? Elle porte l'adresse de la salle (ou au moins un film). Une page de consentement, de contrôle
 * anti-robot ou de maintenance répond 200 sans rien de cela : on la traite comme une erreur, pour garder les données
 * précédentes de la salle au lieu de la retirer.
 */
export const isCinemaPage = (html) => /<p class="adress">/.test(html) || /<div class="subSection[^"]*" id="movie\d+">/.test(html);

/** Films programmés par une salle (page /cinema/<id>/<nom>) : titre, titre original, année, versions, âge, 1re séance. */
export function parseCinemaPage(html, today = todayInBelgium()) {
  // Le pied de page reprend des liens de films : on s'arrête avant.
  const end = html.indexOf('id="footer"');
  const body = end > 0 ? html.slice(0, end) : html;
  const out = [];
  const seen = new Set();
  for (const m of body.matchAll(/<div class="subSection[^"]*" id="movie(\d+)">([\s\S]*?)(?=<div class="subSection[^"]*" id="movie\d+">|$)/g)) {
    const [, slug, block] = m;
    if (seen.has(slug)) continue;
    const h4 = /<h4 class="sshd">([\s\S]*?)<\/h4>/.exec(block)?.[1] ?? '';
    const original = /<span[^>]*class="originalTitle"[^>]*>\s*\(([\s\S]*?)\)\s*<\/span>/.exec(h4)?.[1];
    const title = decode(stripTags(h4.replace(/<span[^>]*class="originalTitle"[\s\S]*?<\/span>/g, '')));
    if (!title) continue;
    seen.add(slug);
    const dates = [...block.matchAll(/<span class="date">\s*(\d{1,2})\/(\d{1,2})\s*<\/span>/g)].map((d) => dayMonthToIso(d[1], d[2], today)).sort();
    const versions = [...new Set([...block.matchAll(/class="audioVersion\s+([A-Za-z]{2,4})"/g)].map((v) => v[1].toUpperCase()))].sort(byVersion);
    // « <abbr title="États-Unis">US</abbr> - 2026 » : pays de production puis année (plusieurs pays possibles).
    const year = Number(/<\/abbr>\s*-\s*((?:19|20)\d{2})\b/.exec(block)?.[1] ?? 0) || null;
    out.push({
      slug,
      title,
      originalTitle: original ? decode(original) : '',
      year,
      versions,
      rating: audienceLabel(/class="movieAudience"[\s\S]*?alt="([^"]*)"/.exec(block)?.[1]),
      firstDate: dates[0] ?? null,
    });
  }
  return out;
}

/**
 * Une entrée par salle qui programme au moins un film. La date de sortie vient de la liste nationale ; un film qui
 * n'y figure pas est « bientôt » si sa première séance dans la salle est après aujourd'hui.
 */
export function cinemasToFeed(theaters, pages, national, today = todayInBelgium()) {
  const meta = new Map(national.map((f) => [f.slug, f]));
  const cinemas = {};
  for (const t of theaters) {
    const page = pages.get(t.id);
    if (!page || page.films.length === 0) continue;
    cinemas[`cinebel-${t.id}`] = {
      name: t.name,
      ...(page.city ? { city: page.city } : {}),
      brand: brandOfTheater(t.name),
      // Date de lecture : une salle illisible ensuite garde ces données quelques jours seulement (l'app l'ignore).
      fetchedAt: today,
      films: page.films.map((f) => {
        const known = meta.get(f.slug);
        const soon = known?.releaseDate ? known.releaseDate > today : Boolean(f.firstDate && f.firstDate > today);
        return {
          slug: f.slug,
          title: f.title || known?.title || '',
          originalTitle: f.originalTitle || known?.originalTitle || '',
          // Année de production : sert à l'app pour distinguer un film de son remake (TMDB date du film, pas de sa sortie belge).
          ...(f.year ? { year: f.year } : {}),
          rating: f.rating,
          language: f.versions.join('/'),
          // La date de sortie ne vient que de la liste nationale : l'app s'en sert aussi pour retrouver le film sur TMDB.
          releaseDate: known?.releaseDate ?? null,
          // Film absent de la liste nationale et pas encore programmé aujourd'hui : sa première séance dans la salle.
          ...(!known?.releaseDate && soon ? { firstShowing: f.firstDate } : {}),
          url: `${BASE}/cinema/${t.id}/${encodeURIComponent(t.name)}#movie${f.slug}`,
          status: soon ? 'coming_soon' : 'now_showing',
        };
      }),
    };
  }
  return cinemas;
}

/** Repli : la liste nationale en une seule entrée « tout le pays » (l'app n'affiche jamais le nom de la source). */
export function cinebelToFeed(films, today = todayInBelgium()) {
  return {
    'cinebel-be': {
      name: 'Cinemas in Belgium (Cinebel)',
      fetchedAt: today,
      films: films.map((f) => ({ slug: f.slug, title: f.title, originalTitle: f.originalTitle, rating: '', language: '', releaseDate: f.releaseDate, url: BASE + f.path, status: f.status })),
    },
  };
}

async function getPath(path) {
  // Délai court : une page bloquée ne doit pas faire durer la collecte des heures (Node attend sinon ~5 min par requête).
  const res = await fetch(BASE + path, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; cinema-data/1.0)', 'Accept-Language': 'fr' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Cinebel ${path} -> ${res.status}`);
  return res.text();
}

/**
 * Données précédentes d'une salle, si elles ont moins de MAX_STALE_DAYS jours ; le statut des films est recalculé
 * (un film « bientôt » dont la date est passée est maintenant à l'affiche).
 */
export function restoredCinema(entry, today = todayInBelgium()) {
  if (!entry?.fetchedAt || daysBetween(entry.fetchedAt, today) > MAX_STALE_DAYS) return null;
  return {
    ...entry,
    films: (entry.films ?? []).map((f) => {
      const date = f.releaseDate ?? f.firstShowing;
      return { ...f, status: date && date > today ? 'coming_soon' : 'now_showing' };
    }),
  };
}

/**
 * @param get      lecteur de page (chemin -> HTML), remplacé dans les tests
 * @param previous entrées du dernier fichier publié : une salle illisible cette fois garde les siennes
 */
export async function fetchCinebel(get = getPath, { maxPages = 40, pauseMs = 250, today = todayInBelgium(), previous = {} } = {}) {
  const pause = () => (pauseMs ? new Promise((r) => setTimeout(r, pauseMs)) : Promise.resolve());

  // 1. Liste nationale (dates de sortie, titres originaux).
  const first = await get('/films');
  const national = parseCinebel(first, today);
  for (let p = 2; p <= Math.min(lastPage(first), maxPages); p++) {
    await pause();
    try { national.push(...parseCinebel(await get(`/films?page=${p}`), today)); } catch (e) { console.warn(`::warning::cinebel page ${p} : ${e.message}`); }
  }
  const seen = new Set();
  const films = national.filter((f) => !seen.has(f.slug) && seen.add(f.slug));

  // 2. et 3. Les salles, une par une.
  const theaters = parseTheaters(first);
  const pages = new Map();
  const failed = [];
  const readCinema = async (t) => {
    const html = await get(`/cinema/${t.id}/${encodeURIComponent(t.name)}`);
    if (!isCinemaPage(html)) throw new Error('page inattendue (ni adresse ni film)');
    return { city: parseCity(html), films: parseCinemaPage(html, today) };
  };
  for (const t of theaters) {
    await pause();
    try {
      pages.set(t.id, await readCinema(t));
    } catch {
      // Une seconde chance, un peu plus tard (erreur passagère du site).
      await new Promise((r) => setTimeout(r, pauseMs * 8));
      try { pages.set(t.id, await readCinema(t)); } catch (e) { failed.push(`${t.id} (${t.name}) : ${e.message}`); }
    }
  }
  if (failed.length > 0) {
    const list = failed.slice(0, 5).join(' ; ') + (failed.length > 5 ? ` ; +${failed.length - 5}` : '');
    console.warn(`::warning::cinebel : ${failed.length}/${theaters.length} salle(s) illisible(s) — ${list}`);
  }

  const cinemas = cinemasToFeed(theaters, pages, films, today);
  let restored = 0;
  for (const t of theaters) {
    const key = `cinebel-${t.id}`;
    const old = pages.has(t.id) ? null : restoredCinema(previous[key], today);
    if (old) { cinemas[key] = old; restored++; }
  }

  const known = pages.size + restored;
  if (known > 0 && known * 2 >= theaters.length && Object.keys(cinemas).length > 0) return cinemas;
  if (films.length === 0) {
    if (Object.keys(cinemas).length > 0) return cinemas;
    throw new Error('Cinebel : aucun film lu');
  }
  // Trop peu de salles connues : la liste nationale complète, pour que les autres films restent « à l'affiche ».
  console.warn(`::warning::cinebel : ${known}/${theaters.length} salle(s) connue(s) — liste nationale ajoutée`);
  return { ...cinemas, ...cinebelToFeed(films, today) };
}
