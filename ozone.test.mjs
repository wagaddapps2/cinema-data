import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ozoneToFeed, parseOzone } from './ozone.mjs';

const p = parseOzone(readFileSync('test-fixtures/ozone.html', 'utf8'));
console.log(p.locations, p.films.filter((f) => f.status === 'now_showing').length, 'now', p.films.filter((f) => f.status === 'coming_soon').length, 'soon');
assert.ok(Object.keys(p.locations).length >= 2);
assert.ok(p.films.filter((f) => f.status === 'now_showing').length >= 10);
const m = p.films.find((f) => f.slug === 'matloub-aaeleyan-arabic');
assert.deepEqual([m.title, m.language, m.rating, m.locationIds], ['Matloub Aaeleyan', 'Arabic', 'R15', ['0000000386']]);
const feed = ozoneToFeed(p, 'https://example.test');
assert.ok(Object.values(feed).every((c) => c.films.every((f) => f.url.startsWith('https://example.test/movies/'))));
console.log('ok', Object.fromEntries(Object.entries(feed).map(([k, v]) => [v.name, v.films.length])));
