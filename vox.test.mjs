import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseComingSoon, parseReleaseDate, parseWhatsOn } from './vox.mjs';

const now = parseWhatsOn(readFileSync('test-fixtures/whatson.html', 'utf8'));
const soon = parseComingSoon(readFileSync('test-fixtures/comingsoon.html', 'utf8'));

assert.equal(now.length, 21);
assert.ok(now.every((m) => m.slug && m.title && m.url.startsWith('https://kwt.voxcinemas.com/movies/')));
const sf = now.find((m) => m.slug === 'street-fighter');
assert.deepEqual([sf.title, sf.rating, sf.language], ['Street Fighter', 'R15', 'English']);

assert.equal(soon.length, 32);
const sf2 = soon.find((m) => m.slug === 'street-fighter');
assert.equal(sf2.releaseDate, '2026-10-15');
assert.equal(sf2.rating, 'R15');
assert.equal(parseReleaseDate('1 March 2027'), '2027-03-01');
assert.equal(parseReleaseDate('soon'), null);
console.log('ok', now.length, 'now,', soon.length, 'soon,', soon.filter((m) => !m.releaseDate).length, 'without date');
