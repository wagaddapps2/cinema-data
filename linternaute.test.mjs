import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FR_CITIES,
  NATIONAL_KEY,
  arrondissementPaths,
  brandOfFrenchCinema,
  cinemasToFeed,
  cityCase,
  cityPath,
  departmentPath,
  fetchLinternaute,
  frAddressText,
  isNationalEntry,
  lastPage,
  locateCinemas,
  parseCinemaSections,
  parseFilms,
  parseFrAddress,
  todayInFrance,
} from './linternaute.mjs';

const fx = (n) => readFileSync(`test-fixtures/${n}.html`, 'utf8');
const quiet = () => {};

// --- Films d'une page (repli national) ---
const arr1 = parseFilms(fx('linternaute'));
assert.equal(arr1.length, 37);
assert.ok(arr1.some((f) => f.slug === '11198196' && f.title === 'Si tu penses bien' && f.url.includes('/tous-les-films/11198196-')));
assert.equal(arrondissementPaths(fx('lint_paris')).length, 20);
assert.equal(departmentPath(fx('lint_hub'), 'bouches-du-rhone'), '/cinema/seances/departement/43/bouches-du-rhone/');
assert.equal(departmentPath(fx('lint_hub'), 'paris'), '/cinema/seances/departement/105/paris/');
assert.equal(cityPath(fx('lint_dep43'), 'marseille'), '/cinema/seances/ville/40035/marseille/');
assert.equal(cityPath(fx('lint_dep43'), 'inexistante'), null);

// --- Salles d'une page de ville : deux par page ---
const paris = parseCinemaSections(fx('lint_paris'));
assert.deepEqual(paris.map((c) => [c.id, c.name]), [['90', 'UGC Ciné-Cité les Halles'], ['3991', 'Pathé La Villette']]);
assert.deepEqual(paris.map((c) => c.films.length), [34, 20]); // un film en deux blocs (deux versions) ne compte qu'une fois
assert.deepEqual(paris[0].address, { street: 'Forum des Halles, niveau - 3, place de la Rotonde', postalCode: '75001', city: 'Paris', country: 'fr' });
assert.deepEqual(paris[1].address, { street: "30 avenue Corentin cariou, Cité des Sciences et de l'Industrie - Vill'Up", postalCode: '75019', city: 'Paris', country: 'fr' });
// Versions de chaque film, d'après ses séances : VF, VO, ou les deux.
const versions = new Set(paris[0].films.map((f) => f.versions.join('/')));
assert.ok(versions.has('VF'));
assert.ok([...versions].some((v) => v.includes('VO')));
for (const f of paris[0].films) assert.ok(f.versions.every((v) => v === 'VF' || v === 'VO'), `${f.title} : ${f.versions}`);
const marseille = parseCinemaSections(fx('lint_marseille'));
assert.deepEqual(marseille.map((c) => [c.id, c.name, c.address.postalCode, c.address.city]), [
  ['4433', 'Europacorp La Joliette', '13001', 'Marseille'],
  ['468', 'Les 3 Palmes', '13011', 'Marseille'],
]);
// « En 3DVF » compte pour la VF.
assert.ok(marseille[0].films.every((f) => f.versions.length > 0));
assert.deepEqual(parseCinemaSections('<html>rien</html>'), []);
assert.deepEqual(parseCinemaSections('<div class="cinema_header"><address>sans lien</address></div>'), []);

// --- Pagination : deux salles par page ---
assert.equal(lastPage(fx('lint_paris')), 40);
assert.equal(lastPage(fx('lint_marseille')), 6);
assert.equal(lastPage('<p>sans pagination</p>'), 1);

// --- Adresses ---
assert.deepEqual(parseFrAddress('<h2 class="cinema_name"><a>Le Grand Rex</a></h2><br> 1 boulevard Poissonnière - 75002 PARIS'), {
  street: '1 boulevard Poissonnière', postalCode: '75002', city: 'Paris', country: 'fr',
});
assert.deepEqual(parseFrAddress('Rue X, 13100 AIX-EN-PROVENCE'), { street: 'Rue X', postalCode: '13100', city: 'Aix-en-Provence', country: 'fr' });
assert.equal(parseFrAddress('Pas d’adresse'), null);
assert.equal(parseFrAddress(undefined), null);
assert.equal(cityCase('BOULOGNE-SUR-MER'), 'Boulogne-sur-Mer');
assert.equal(cityCase('LA ROCHELLE'), 'La Rochelle');
assert.equal(frAddressText({ street: '54 Rue de Chanterac', postalCode: '13001', city: 'Marseille' }), '54 Rue de Chanterac, 13001 Marseille');

// --- Enseignes ---
assert.equal(brandOfFrenchCinema('UGC Ciné-Cité les Halles'), 'UGC');
assert.equal(brandOfFrenchCinema('Pathé La Villette'), 'Pathé');
assert.equal(brandOfFrenchCinema('Pathe Wepler'), 'Pathé');
assert.equal(brandOfFrenchCinema('mk2 Bibliothèque'), 'MK2');
assert.equal(brandOfFrenchCinema('Les 3 Palmes'), '');
assert.equal(brandOfFrenchCinema('UGCX'), ''); // un mot entier
assert.equal(brandOfFrenchCinema('Le Pathé'), ''); // en tête seulement

// --- Date du jour en France ---
assert.equal(todayInFrance(new Date('2026-10-13T22:30:00Z')), '2026-10-14'); // minuit passé à Paris
assert.equal(todayInFrance(new Date('2026-10-13T12:00:00Z')), '2026-10-13');

// --- Fichier publié ---
{
  const feed = cinemasToFeed([
    { id: '90', name: 'UGC Ciné-Cité les Halles', city: 'Paris', address: paris[0].address, lat: 48.86, lng: 2.35, films: paris[0].films.slice(0, 2) },
    { id: '7', name: 'Salle vide', city: 'Paris', address: null, films: [] },
  ], '2026-10-13');
  assert.deepEqual(Object.keys(feed), ['linternaute-90']); // une salle sans film n'est pas publiée
  const e = feed['linternaute-90'];
  assert.equal(e.city, 'Paris');
  assert.equal(e.brand, 'UGC');
  assert.equal(e.address, 'Forum des Halles, niveau - 3, place de la Rotonde, 75001 Paris');
  assert.equal(e.lat, 48.86);
  assert.equal(e.fetchedAt, '2026-10-13');
  assert.equal(e.films.length, 2);
  assert.deepEqual(Object.keys(e.films[0]).sort(), ['language', 'rating', 'releaseDate', 'slug', 'status', 'title', 'url']);
  assert.ok(e.films.every((f) => f.status === 'now_showing' && f.url.startsWith('https://www.linternaute.com/')));
  assert.ok(isNationalEntry({ name: 'Cinemas in France (Linternaute)' }));
  assert.ok(!isNationalEntry({ name: 'UGC Ciné-Cité les Halles' }));
}

// --- Coordonnées : une recherche par salle, reprises tant que l'adresse ne change pas ---
{
  const cinemas = parseCinemaSections(fx('lint_paris')).map((c) => ({ ...c, city: 'Paris' }));
  const previous = { 'linternaute-90': { address: frAddressText(cinemas[0].address), lat: 48.8625, lng: 2.3469 } };
  const asked = [];
  const geocode = async (a) => { asked.push(a); return { lat: 48.89, lng: 2.39 }; };
  const counts = await locateCinemas(cinemas, previous, geocode, quiet);
  assert.deepEqual(counts, { reused: 1, found: 1, missing: 0 });
  assert.equal(asked.length, 1); // la salle déjà localisée n'est pas recherchée
  assert.equal(asked[0].country, 'fr');
  assert.deepEqual([cinemas[0].lat, cinemas[1].lat], [48.8625, 48.89]);
  // Adresse changée : nouvelle recherche.
  const moved = parseCinemaSections(fx('lint_paris')).map((c) => ({ ...c, city: 'Paris' }));
  const again = await locateCinemas(moved, { 'linternaute-90': { address: 'ailleurs', lat: 1, lng: 1 } }, async () => ({ lat: 48.1, lng: 2.1 }), quiet);
  assert.equal(again.found, 2);
  // Service en panne : trois échecs de suite, puis on laisse le service tranquille.
  let calls = 0;
  const many = Array.from({ length: 5 }, (_, i) => ({ id: String(i), name: `S${i}`, address: { street: `${i} rue X`, postalCode: '75001', city: 'Paris', country: 'fr' }, films: [{}] }));
  const down = await locateCinemas(many, {}, async () => { calls++; throw new Error('HTTP 429'); }, quiet);
  assert.equal(calls, 3);
  assert.equal(down.missing, 5);
  // Sans géocodeur : rien n'est cherché.
  assert.deepEqual(await locateCinemas(parseCinemaSections(fx('lint_marseille')), {}, undefined, quiet), { reused: 0, found: 0, missing: 2 });
}

// --- Parcours complet avec un faux site : Paris (40 pages), Marseille (6 pages), une ville introuvable ---
const parisDep = '<a href="/cinema/seances/ville/30438/paris/">Paris</a>';
const site = (overrides = {}) => {
  const asked = [];
  const pages = {
    '/cinema/seances/': fx('lint_hub'),
    '/cinema/seances/departement/105/paris/': parisDep,
    '/cinema/seances/ville/30438/paris/': fx('lint_paris'),
    '/cinema/seances/departement/43/bouches-du-rhone/': fx('lint_dep43'),
    '/cinema/seances/ville/40035/marseille/': fx('lint_marseille'),
    ...overrides,
  };
  const get = async (p) => {
    asked.push(p);
    if (p in pages) {
      const page = pages[p];
      if (page instanceof Error) throw page;
      return page;
    }
    // Pages suivantes : les mêmes salles reviennent (comptées une fois) ; Paris page 7 en panne.
    if (p === '/cinema/seances/ville/30438/paris/?page=7') throw new Error('Linternaute -> 500');
    if (p.startsWith('/cinema/seances/ville/30438/paris/?page=')) return fx('linternaute');
    if (p.startsWith('/cinema/seances/ville/40035/marseille/?page=')) return fx('lint_marseille');
    throw new Error('404');
  };
  return { get, asked };
};
const cities = [FR_CITIES[0], FR_CITIES[1], { dep: 'rhone', city: 'lyon-inconnue', label: 'Lyon' }];
{
  const { get, asked } = site();
  const warnings = [];
  const feed = await fetchLinternaute(get, { cities, pauseMs: 0, today: '2026-10-13', warn: (w) => warnings.push(w) });
  assert.deepEqual(Object.keys(feed).sort(), ['linternaute-3991', 'linternaute-4433', 'linternaute-468', 'linternaute-72', 'linternaute-90']);
  assert.equal(feed['linternaute-90'].city, 'Paris');
  assert.equal(feed['linternaute-72'].city, 'Paris'); // Forum des images, sur une page suivante
  assert.equal(feed['linternaute-4433'].city, 'Marseille');
  assert.equal(feed['linternaute-468'].brand, '');
  assert.equal(feed['linternaute-3991'].brand, 'Pathé');
  assert.ok(!(NATIONAL_KEY in feed)); // des salles : pas d'entrée nationale
  // Toutes les pages d'une ville sont lues, jusqu'à la dernière.
  assert.equal(asked.filter((p) => p.startsWith('/cinema/seances/ville/30438/paris/?page=')).length, 39);
  assert.equal(asked.filter((p) => p.startsWith('/cinema/seances/ville/40035/marseille/?page=')).length, 5);
  assert.ok(warnings.some((w) => w.includes('page 7')));
  assert.ok(warnings.some((w) => w.includes('lyon-inconnue')));
}
{
  // Plafond de pages par ville.
  const { get, asked } = site();
  await fetchLinternaute(get, { cities: [FR_CITIES[0]], pauseMs: 0, maxPages: 3, warn: quiet });
  assert.deepEqual(asked.filter((p) => p.includes('?page=')), ['/cinema/seances/ville/30438/paris/?page=2', '/cinema/seances/ville/30438/paris/?page=3']);
}
{
  // Une salle absente cette fois garde ses données précédentes trois jours au plus ; l'ancienne entrée nationale part.
  const { get } = site();
  const previous = {
    'linternaute-555': { name: 'Le Champo', city: 'Paris', fetchedAt: '2026-10-11', films: [{ slug: '1', title: 'Vertigo', releaseDate: null, status: 'now_showing' }] },
    'linternaute-556': { name: 'Trop vieux', city: 'Paris', fetchedAt: '2026-10-01', films: [{ slug: '2', title: 'X', releaseDate: null, status: 'now_showing' }] },
    [NATIONAL_KEY]: { name: 'Cinemas in France (Linternaute)', films: [] },
    'cinebel-1': { name: 'Autre pays', fetchedAt: '2026-10-13', films: [] },
  };
  const feed = await fetchLinternaute(get, { cities, pauseMs: 0, today: '2026-10-13', previous, warn: quiet });
  assert.equal(feed['linternaute-555']?.name, 'Le Champo');
  assert.ok(!('linternaute-556' in feed));
  assert.ok(!(NATIONAL_KEY in feed));
  assert.ok(!('cinebel-1' in feed));
}
{
  // Le site a changé : plus aucune salle reconnue -> la liste nationale, comme avant.
  const noSections = fx('linternaute').split('<div class="cinema_header">').join('<div class="autre">');
  const { get } = site({ '/cinema/seances/ville/30438/paris/': noSections });
  const warnings = [];
  const feed = await fetchLinternaute(get, { cities: [FR_CITIES[0]], pauseMs: 0, maxPages: 1, warn: (w) => warnings.push(w) });
  assert.deepEqual(Object.keys(feed), [NATIONAL_KEY]);
  assert.equal(feed[NATIONAL_KEY].name, 'Cinemas in France (Linternaute)');
  assert.ok(feed[NATIONAL_KEY].films.length >= 37);
  assert.equal(new Set(feed[NATIONAL_KEY].films.map((f) => f.slug)).size, feed[NATIONAL_KEY].films.length, 'sans doublons');
  assert.ok(warnings.some((w) => w.includes('aucune salle')));
}
{
  // Rien du tout : erreur (le build garde alors les données précédentes).
  const { get } = site({ '/cinema/seances/ville/30438/paris/': '<html></html>' });
  await assert.rejects(fetchLinternaute(get, { cities: [FR_CITIES[0]], pauseMs: 0, maxPages: 1, warn: quiet }), /aucun film/);
}
{
  // Avec un géocodeur : les salles publiées ont leur position.
  const { get } = site();
  const feed = await fetchLinternaute(get, { cities: [FR_CITIES[1]], pauseMs: 0, geocode: async () => ({ lat: 43.3, lng: 5.37 }), warn: quiet });
  assert.deepEqual([feed['linternaute-4433'].lat, feed['linternaute-4433'].lng], [43.3, 5.37]);
  assert.equal(feed['linternaute-4433'].address, '54 Rue de Chanterac, 13001 Marseille');
}
console.log('ok linternaute');
