import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanTitle, parseSky, skyToFeed } from './sky.mjs';

const films = parseSky(readFileSync('test-fixtures/sky.html', 'utf8'));
const now = films.filter((f) => f.status === 'now_showing');
const soon = films.filter((f) => f.status === 'coming_soon');
console.log(now.length, 'now', soon.length, 'soon', now.map((f) => f.title));
assert.ok(now.length >= 3 && soon.length >= 3);
assert.ok(now.some((f) => f.title === 'OTHER MOMMY' && f.slug === 'other-mommy/9999001516'));
assert.equal(cleanTitle('MATLOUB AAELEYAN (EGYPTIAN) - ARABIC'), 'MATLOUB AAELEYAN');
assert.equal(cleanTitle('AVENGERS: DOOMSDAY'), 'AVENGERS: DOOMSDAY');
const feed = skyToFeed(films, 'https://example.test');
assert.ok(feed['sky-salmiya'].films.every((f) => f.url.startsWith('https://example.test/movie-information/')));
console.log('ok');
