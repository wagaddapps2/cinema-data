import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arrondissementPaths, cityPath, departmentPath, fetchLinternaute, parseFilms } from './linternaute.mjs';

const fx = (n) => readFileSync(`test-fixtures/${n}.html`, 'utf8');
const arr1 = parseFilms(fx('linternaute'));
assert.equal(arr1.length, 37);
assert.ok(arr1.some((f) => f.slug === '11198196' && f.title === 'Si tu penses bien' && f.url.includes('/tous-les-films/11198196-')));
assert.equal(arrondissementPaths(fx('lint_paris')).length, 20);
assert.equal(departmentPath(fx('lint_hub'), 'bouches-du-rhone'), '/cinema/seances/departement/43/bouches-du-rhone/');
assert.equal(cityPath(fx('lint_dep43'), 'marseille'), '/cinema/seances/ville/40035/marseille/');
assert.equal(cityPath(fx('lint_dep43'), 'inexistante'), null);

// Parcours complet avec un faux site : Paris (ville + arrondissements), Marseille, une ville introuvable.
const pages = {
  '/cinema/seances/': fx('lint_hub'),
  '/cinema/seances/departement/43/bouches-du-rhone/': fx('lint_dep43'),
  '/cinema/seances/ville/40035/marseille/': fx('lint_marseille'),
};
const get = async (p) => { if (p in pages) return pages[p]; if (p.includes('/arrondissement/')) return fx('linternaute'); throw new Error('404'); };
const feed = await fetchLinternaute(get, [{ dep: 'bouches-du-rhone', city: 'marseille' }, { dep: 'rhone', city: 'lyon-inconnue' }], 0);
const films = feed['linternaute-fr'].films;
assert.ok(films.length >= 37, `films: ${films.length}`);
assert.equal(new Set(films.map((f) => f.slug)).size, films.length, 'sans doublons');
console.log('ok', films.length, 'films');
