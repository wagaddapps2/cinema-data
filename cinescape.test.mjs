import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cinescapeToFeed, fetchCinescape, parseCinescape } from './cinescape.mjs';

const html = readFileSync('test-fixtures/cinescape.html', 'utf8');
const films = parseCinescape(html, 'now_showing');
assert.equal(films.length, 19);
const byCode = Object.fromEntries(films.map((f) => [f.slug, f]));
assert.deepEqual([byCode.HO00004534.title, byCode.HO00004534.rating], ['Matloub Aaeleyan', 'R15']);
assert.equal(byCode.HO00004502.title, 'SB19 Wakas at Simula:The Trilogy');
assert.equal(byCode.HO00004523.title, 'Beware Boiúna');
assert.equal(cinescapeToFeed(films)['cinescape-kw'].films.length, 19);
// fetchCinescape avec un rendu injecté : la page « bientôt » en échec ne fait pas échouer l'ensemble.
const feed = await fetchCinescape(async (u) => { if (u.endsWith('/comingsoon')) throw new Error('boom'); return html; });
assert.equal(feed['cinescape-kw'].films.length, 19);
console.log('ok', films.length, 'films');
