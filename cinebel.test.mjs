import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  audienceLabel, brandOfTheater, cinemasToFeed, dayMonthToIso, fetchCinebel, isCinemaPage, lastPage, parseCinebel,
  parseCinemaPage, parseCity, parseFrDate, parseTheaters, restoredCinema, todayInBelgium,
} from './cinebel.mjs';

// --- Liste nationale « Films à l'affiche » ---
const html = readFileSync('test-fixtures/cinebel_films.html', 'utf8');
const films = parseCinebel(html, '2026-10-10');
console.log(films.length, 'films page 1;', films.slice(0, 3).map((f) => `${f.title} | ${f.originalTitle} | ${f.releaseDate} | ${f.status}`));
assert.equal(films.length, 10);
const fi = films.find((f) => f.slug === '1027524');
assert.deepEqual([fi.title, fi.originalTitle, fi.releaseDate, fi.path], ["L'île des souvenirs", 'Forgotten Island', '2026-10-07', '/film/1027524/Forgotten%20Island']);
assert.equal(lastPage(html), 35);
assert.equal(parseFrDate('12/01/2027'), '2027-01-12');
assert.equal(parseCinebel(html, '2026-10-01').find((f) => f.slug === '1027524').status, 'coming_soon');

// --- Les salles : le menu « Cinéma » est sur chaque page ---
const theaters = parseTheaters(html);
console.log(theaters.length, 'salles ;', theaters.slice(0, 3).map((t) => `${t.id}=${t.name}`).join(', '));
assert.equal(theaters.length, 66);
assert.deepEqual(theaters[0], { id: '693', name: 'Aventure Ciné Confort' });
assert.ok(theaters.some((t) => t.id === '730' && t.name === "UGC Toison d'Or"));
assert.ok(theaters.some((t) => t.id === '956' && t.name === 'Cinéma For&ver'));

// --- Page d'une salle ---
const cinema = readFileSync('test-fixtures/cinebel_cinema.html', 'utf8');
assert.equal(parseCity(cinema), 'Bruxelles');
assert.equal(parseCity('<p class="adress">Rue X 1<br/>L-9530&nbsp;Wiltz <br/>Téléphone : 1</p>'), 'Wiltz');
const shows = parseCinemaPage(cinema, '2026-10-11');
console.log(shows.map((f) => `${f.slug} ${f.title} (${f.originalTitle || '-'}) ${f.year} ${f.versions.join('/')} ${f.rating || '-'} ${f.firstDate}`));
// Le faux bloc du pied de page n'est pas un film de la salle.
assert.deepEqual(shows.map((f) => f.slug), ['1027874', '1027125', '1022876', '1099999']);
assert.deepEqual(shows[0], { slug: '1027874', title: 'Chopin, Chopin!', originalTitle: '', year: 2025, versions: ['VO'], rating: 'AL', firstDate: '2026-10-11' });
assert.deepEqual([shows[1].versions, shows[1].rating, shows[1].year], [['VF', 'VO'], '12+', 2026]);
// Titre original avec une espace avant la parenthèse fermante, comme sur le site.
assert.deepEqual([shows[2].title, shows[2].originalTitle, shows[2].rating, shows[2].year], ['Julie (en 12 chapitres) / The Worst Person in the World', 'Verdens verste menneske', '14+', 2021]);
assert.deepEqual([shows[3].title, shows[3].versions, shows[3].firstDate, shows[3].year, shows[3].rating], ['Film de test & avant-première', ['NV'], '2026-10-15', 2026, '']);

assert.equal(audienceLabel('À partir de 16 ans'), '16+');
assert.equal(audienceLabel('Tout public'), 'AL');
assert.equal(audienceLabel(undefined), '');
assert.equal(dayMonthToIso('2', '1', '2026-12-30'), '2027-01-02'); // séances de janvier vues fin décembre
assert.equal(dayMonthToIso('30', '12', '2027-01-02'), '2026-12-30');
assert.match(todayInBelgium(), /^\d{4}-\d{2}-\d{2}$/);
assert.equal(todayInBelgium(new Date('2026-10-10T22:30:00Z')), '2026-10-11'); // minuit passé à Bruxelles
assert.equal(todayInBelgium(new Date('2026-01-31T23:30:00Z')), '2026-02-01');
assert.ok(isCinemaPage(cinema));
assert.ok(!isCinemaPage('<html><title>Just a moment...</title><body>Checking your browser</body></html>'));
// Enseignes : seules les vraies chaînes sont regroupées par l'app.
assert.equal(brandOfTheater('Kinepolis Imagibraine'), 'Kinepolis');
assert.equal(brandOfTheater('Pathé Acinapolis Namur'), 'Pathé');
assert.equal(brandOfTheater('Plaza Hotton'), '');
assert.equal(brandOfTheater('Palace (Liège)'), '');

// --- Fichier : une entrée par salle, datée par la liste nationale ---
const national = [
  { slug: '1027125', title: 'Digger', originalTitle: '', releaseDate: '2026-10-08' },
  { slug: '1027874', title: 'Chopin, Chopin!', originalTitle: '', releaseDate: '2026-10-14' }, // avant-première
];
const feed = cinemasToFeed([{ id: '730', name: "UGC Toison d'Or" }, { id: '1', name: 'Vide' }], new Map([['730', { city: 'Bruxelles', films: shows }], ['1', { city: 'Ath', films: [] }]]), national, '2026-10-11');
assert.deepEqual(Object.keys(feed), ['cinebel-730']); // une salle sans film n'est pas publiée
const ugc = feed['cinebel-730'];
assert.equal(ugc.name, "UGC Toison d'Or");
assert.equal(ugc.city, 'Bruxelles');
assert.equal(ugc.brand, 'UGC');
assert.equal(ugc.fetchedAt, '2026-10-11');
const byTitle = Object.fromEntries(ugc.films.map((f) => [f.title, f]));
assert.deepEqual(byTitle.Digger, {
  slug: '1027125', title: 'Digger', originalTitle: '', year: 2026, rating: '12+', language: 'VF/VO', releaseDate: '2026-10-08',
  url: "https://cinebel.dhnet.be/cinema/730/UGC%20Toison%20d'Or#movie1027125", status: 'now_showing',
});
assert.deepEqual([byTitle['Chopin, Chopin!'].status, byTitle['Chopin, Chopin!'].releaseDate], ['coming_soon', '2026-10-14']);
// Absent de la liste nationale : « bientôt » d'après sa première séance, donnée à part (la date de sortie reste vide).
const avp = byTitle['Film de test & avant-première'];
assert.deepEqual([avp.status, avp.releaseDate, avp.firstShowing], ['coming_soon', null, '2026-10-15']);
assert.ok(!('firstShowing' in byTitle.Digger));
// Absent de la liste nationale mais déjà programmé aujourd'hui : à l'affiche, sans date.
const julie = byTitle['Julie (en 12 chapitres) / The Worst Person in the World'];
assert.deepEqual([julie.status, julie.releaseDate, julie.originalTitle, julie.language], ['now_showing', null, 'Verdens verste menneske', 'VO']);

// Données précédentes : gardées 3 jours au plus, statut recalculé.
const old = { name: 'X', fetchedAt: '2026-10-09', films: [
  { slug: '1', title: 'A', releaseDate: '2026-10-10', status: 'coming_soon' },
  { slug: '2', title: 'B', releaseDate: '2026-10-20', status: 'coming_soon' },
  { slug: '3', title: 'C', releaseDate: null, firstShowing: '2026-10-11', status: 'coming_soon' },
] };
assert.deepEqual(restoredCinema(old, '2026-10-11').films.map((f) => f.status), ['now_showing', 'coming_soon', 'now_showing']);
assert.equal(restoredCinema(old, '2026-10-12').fetchedAt, '2026-10-09'); // 3 jours : encore gardées
assert.equal(restoredCinema(old, '2026-10-13'), null); // plus de 3 jours
assert.equal(restoredCinema({ name: 'Y', films: [] }, '2026-10-11'), null); // sans date de lecture

// --- Collecte complète, avec un faux site ---
const calls = [];
const film = (slug) => ({ slug, title: 'Ancien', rating: '', language: '', releaseDate: '2026-09-01', url: 'u', status: 'coming_soon' });
const previous = {
  'cinebel-693': { name: 'Aventure Ciné Confort', city: 'Bruxelles', brand: '', fetchedAt: '2026-10-10', films: [film('x')] },
  'cinebel-712': { name: 'Bozar', city: 'Bruxelles', brand: '', fetchedAt: '2026-10-01', films: [film('y')] }, // trop ancien
  'cinebel-706': { name: 'CINEMATEK', city: 'Bruxelles', brand: '', fetchedAt: '2026-10-10', films: [film('z')] },
};
const emptyCinema = '<html><body><p class="adress">Rue<br/>1000&nbsp;Bruxelles</p></body></html>';
const site = async (path) => {
  calls.push(path);
  if (path.startsWith('/films')) { if (path === '/films?page=2') throw new Error('boom'); return html; }
  if (path === "/cinema/730/UGC%20Toison%20d'Or") return cinema;
  if (path.startsWith('/cinema/693/') || path.startsWith('/cinema/712/')) throw new Error('Cinebel 500');
  // Page de contrôle anti-robot, servie avec un code 200 : ce n'est pas une salle sans film.
  if (path.startsWith('/cinema/706/')) return '<html><title>Just a moment...</title></html>';
  return emptyCinema;
};
const out = await fetchCinebel(site, { maxPages: 3, pauseMs: 0, today: '2026-10-11', previous });
assert.ok(calls.includes('/films?page=3')); // une page nationale en échec n'arrête pas la collecte
assert.equal(calls.filter((c) => c.startsWith('/cinema/')).length, 66 + 3); // une seconde chance pour 3 salles
assert.ok(calls.includes('/cinema/693/Aventure%20Cin%C3%A9%20Confort')); // nom encodé dans l'adresse
assert.deepEqual(Object.keys(out).sort(), ['cinebel-693', 'cinebel-706', 'cinebel-730']);
assert.equal(out['cinebel-693'].films[0].status, 'now_showing'); // données précédentes, statut à jour
assert.equal(out['cinebel-706'].films[0].slug, 'z'); // page anti-robot : données précédentes gardées
assert.equal(out['cinebel-730'].films.length, 4);
assert.ok(!('cinebel-be' in out));

// Moins de la moitié des salles connues : la liste nationale s'ajoute aux salles lues.
const partial = await fetchCinebel(async (p) => {
  if (p.startsWith('/films')) return html;
  if (p === "/cinema/730/UGC%20Toison%20d'Or") return cinema;
  throw new Error('rate limited');
}, { maxPages: 1, pauseMs: 0, today: '2026-10-11' });
assert.deepEqual(Object.keys(partial).sort(), ['cinebel-730', 'cinebel-be']);

// Aucune page de salle lisible : repli sur la liste nationale (une entrée « tout le pays »).
const fallback = await fetchCinebel(async (p) => { if (p.startsWith('/cinema/')) throw new Error('down'); return html; }, { maxPages: 2, pauseMs: 0, today: '2026-10-10' });
assert.deepEqual(Object.keys(fallback), ['cinebel-be']);
assert.equal(fallback['cinebel-be'].films.length, 10); // pages identiques : dédoublonnées par identifiant
assert.equal(fallback['cinebel-be'].fetchedAt, '2026-10-10'); // l'entrée nationale vieillit comme les salles
console.log('ok');
