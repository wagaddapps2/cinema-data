import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CINESCAPE_BRANCHES, fetchCinescapeViaElcinema, parseTheater } from './cinescape-elcinema.mjs';

const films = parseTheater(readFileSync('test-fixtures/eltheater_avenues.html', 'utf8'));
console.log(films.length, 'films', films.map((f) => f.title));
assert.ok(films.length >= 5);
assert.ok(films.some((f) => f.title === 'Matloub Aaeleyan' && f.slug === '2099520'));
assert.equal(new Set(films.map((f) => f.slug)).size, films.length, 'sans doublons');
// Une salle en échec ne fait pas échouer les autres.
const html = readFileSync('test-fixtures/eltheater_avenues.html', 'utf8');
const feed = await fetchCinescapeViaElcinema(async (id) => { if (id === '3101202') throw new Error('boom'); return html; });
assert.equal(Object.keys(feed).length, Object.keys(CINESCAPE_BRANCHES).length - 1);
console.log('ok');
