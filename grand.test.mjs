import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { grandToFeed, parseGrandCinemas } from './grand.mjs';

const p = parseGrandCinemas(readFileSync('test-fixtures/grand.html', 'utf8'));
assert.deepEqual(p.cinemas, { 1: 'Grand Hamra', 4: 'Grand Al Andalus' });
assert.equal(p.films.filter((f) => f.status === 'now_showing').length, 10);
assert.equal(p.films.filter((f) => f.status === 'coming_soon').length, 18);
const hob = p.films.find((f) => f.slug === 'heart-of-the-beast');
assert.deepEqual([hob.title, hob.rating, hob.cinemaIds.sort()], ['HEART OF THE BEAST', 'PG12', ['1', '4']]);
const feed = grandToFeed(p, 'https://example.test');
assert.equal(Object.keys(feed).length, 2);
assert.ok(feed['grand-1'].films.every((f) => f.url.startsWith('https://example.test/movie/')));
console.log('ok', Object.fromEntries(Object.entries(feed).map(([k, v]) => [k, v.films.filter((f) => f.status === 'now_showing').length + ' now'])));
