import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fetchCinebel, lastPage, parseCinebel, parseFrDate } from './cinebel.mjs';

const html = readFileSync('test-fixtures/cinebel_films.html', 'utf8');
const films = parseCinebel(html, '2026-10-10');
console.log(films.length, 'films page 1;', films.slice(0, 3).map((f) => `${f.title} | ${f.originalTitle} | ${f.releaseDate} | ${f.status}`));
assert.equal(films.length, 10);
const fi = films.find((f) => f.slug === '1027524');
assert.deepEqual([fi.title, fi.originalTitle, fi.releaseDate, fi.path], ["L'île des souvenirs", 'Forgotten Island', '2026-10-07', '/film/1027524/Forgotten%20Island']);
assert.equal(lastPage(html), 35);
assert.equal(parseFrDate('12/01/2027'), '2027-01-12');
assert.equal(parseCinebel(html, '2026-10-01').find((f) => f.slug === '1027524').status, 'coming_soon');
// Une page en échec ne fait pas échouer l'ensemble.
const feed = await fetchCinebel(async (p) => { if (p === 3) throw new Error('boom'); return html; }, 4, 0);
assert.equal(feed['cinebel-be'].films.length, 10); // pages identiques : dédoublonnées par identifiant
console.log('ok');
