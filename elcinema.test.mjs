import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lastPage, parseDate, parseElcinema } from './elcinema.mjs';

const kw = readFileSync('test-fixtures/elnow_kw.html', 'utf8');
const films = parseElcinema(kw, 'now_showing');
assert.equal(films.length, 15);
const beast = films.find((f) => f.title === 'The Beast');
assert.deepEqual([beast.slug, beast.releaseDate], ['2101678', '2026-10-08']);
assert.equal(lastPage(kw), 2);
const soon = parseElcinema(readFileSync('test-fixtures/elsoon.html', 'utf8'), 'coming_soon');
assert.equal(soon.length, 15);
assert.ok(soon.filter((f) => f.releaseDate).length >= 10, 'la plupart ont une date de sortie');
assert.equal(parseDate('1 March 2027'), '2027-03-01');
console.log('ok', films.length, 'now (kw page 1),', soon.length, 'soon (gulf page 1), sample:', soon[0]);
