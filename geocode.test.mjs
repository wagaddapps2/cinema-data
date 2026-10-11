import assert from 'node:assert/strict';
import { GeocoderError, createNominatimGeocoder, geocodeQueries, inBelgiumLuxembourg } from './geocode.mjs';

// --- Recherches, de la plus précise à la plus large ---
const toison = { street: "Avenue de la Toison d'Or 8-17", postalCode: '1050', city: 'Bruxelles', country: 'be' };
assert.deepEqual(geocodeQueries(toison), [
  { q: "Avenue de la Toison d'Or 8-17, 1050 Bruxelles", precision: 'address' },
  { q: "Avenue de la Toison d'Or, 1050 Bruxelles", precision: 'street' },
  { q: '1050 Bruxelles', precision: 'postcode' },
]);
const bare = (street) => geocodeQueries({ street, postalCode: '5000', city: 'Namur' }).find((q) => q.precision === 'street')?.q;
assert.equal(bare('Rue du 11 Novembre 12'), 'Rue du 11 Novembre, 5000 Namur'); // le « 11 » fait partie du nom de la rue
assert.equal(bare('Place du 20 Août 7A'), 'Place du 20 Août, 5000 Namur');
assert.equal(bare('Chaussée de Bruxelles 27/3'), 'Chaussée de Bruxelles, 5000 Namur');
assert.equal(bare('Rue Neuve 12 bte 3'), 'Rue Neuve, 5000 Namur');
assert.equal(bare('Avenue X 8-17'), 'Avenue X, 5000 Namur');
assert.equal(bare('Rue Sans Numéro'), undefined); // rien à retirer : pas de recherche en double
assert.deepEqual(geocodeQueries({ street: '', postalCode: '1000', city: 'Bruxelles' }), [{ q: '1000 Bruxelles', precision: 'postcode' }]);
assert.deepEqual(geocodeQueries({}), []);

assert.ok(inBelgiumLuxembourg(50.8353, 4.3604)); // Bruxelles
assert.ok(inBelgiumLuxembourg(49.61, 6.13)); // Luxembourg
assert.ok(!inBelgiumLuxembourg(48.85, 2.35)); // Paris
assert.ok(!inBelgiumLuxembourg(52.37, 4.9)); // Amsterdam

// --- Service : faux Nominatim ---
const json = (rows, status = 200) => ({ ok: status === 200, status, json: async () => rows });
const fake = (answers) => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: new URL(url), init });
    const a = answers.shift();
    if (a instanceof Error) throw a;
    return a;
  };
  return { calls, fetchImpl };
};
const fastClock = { minGapMs: 0 };

{
  const { calls, fetchImpl } = fake([json([{ lat: '50.835312', lon: '4.360449' }])]);
  const geocode = createNominatimGeocoder({ fetchImpl, userAgent: 'test-agent/1.0', ...fastClock });
  assert.deepEqual(await geocode(toison), { lat: 50.8353, lng: 4.3604, precision: 'address' }); // arrondi à ~11 m
  assert.equal(calls.length, 1); // trouvée du premier coup : pas d'autre recherche
  const { url, init } = calls[0];
  assert.equal(url.origin + url.pathname, 'https://nominatim.openstreetmap.org/search');
  assert.equal(url.searchParams.get('q'), "Avenue de la Toison d'Or 8-17, 1050 Bruxelles");
  assert.equal(url.searchParams.get('countrycodes'), 'be');
  assert.equal(url.searchParams.get('limit'), '1');
  assert.equal(url.searchParams.get('format'), 'jsonv2');
  assert.equal(init.headers['User-Agent'], 'test-agent/1.0'); // Nominatim exige une application identifiée
}
{
  // Introuvable avec le numéro, trouvée par la rue seule.
  const { calls, fetchImpl } = fake([json([]), json([{ lat: '50.63', lon: '5.57' }])]);
  const geocode = createNominatimGeocoder({ fetchImpl, ...fastClock });
  assert.deepEqual(await geocode(toison), { lat: 50.63, lng: 5.57, precision: 'street' });
  assert.equal(calls.length, 2);
}
{
  // Un résultat hors de Belgique/Luxembourg est une mauvaise correspondance : on essaie la recherche suivante.
  const { calls, fetchImpl } = fake([json([{ lat: '48.85', lon: '2.35' }]), json([{ lat: '48.85', lon: '2.35' }]), json([{ lat: '50.85', lon: '4.35' }])]);
  const geocode = createNominatimGeocoder({ fetchImpl, ...fastClock });
  assert.deepEqual(await geocode(toison), { lat: 50.85, lng: 4.35, precision: 'postcode' });
  assert.equal(calls.length, 3);
}
{
  // Rien nulle part : null (adresse introuvable), pas une erreur.
  const { fetchImpl } = fake([json([]), json([]), json([])]);
  assert.equal(await createNominatimGeocoder({ fetchImpl, ...fastClock })(toison), null);
  // Réponse sans coordonnées lisibles.
  const bad = fake([json([{ lat: 'x', lon: 'y' }]), json({}), json([null])]);
  assert.equal(await createNominatimGeocoder({ fetchImpl: bad.fetchImpl, ...fastClock })(toison), null);
}
{
  // Luxembourg : le pays est passé au service.
  const { calls, fetchImpl } = fake([json([{ lat: '49.96', lon: '5.93' }])]);
  await createNominatimGeocoder({ fetchImpl, ...fastClock })({ street: 'Rue X 1', postalCode: '9530', city: 'Wiltz', country: 'lu' });
  assert.equal(calls[0].url.searchParams.get('countrycodes'), 'lu');
}
{
  // Service indisponible : une erreur (pas « introuvable »), et on n'insiste pas avec les recherches suivantes.
  for (const answers of [[json([], 429)], [json([], 403)], [json([], 503)], [new Error('fetch failed')], [{ ok: true, status: 200, json: async () => { throw new Error('not json'); } }]]) {
    const { calls, fetchImpl } = fake(answers);
    await assert.rejects(createNominatimGeocoder({ fetchImpl, ...fastClock })(toison), GeocoderError);
    assert.equal(calls.length, 1);
  }
  const { fetchImpl } = fake([json([], 429)]);
  await assert.rejects(createNominatimGeocoder({ fetchImpl, ...fastClock })(toison), /HTTP 429/);
}
{
  // Une requête par seconde au plus : attente entre deux recherches, aucune avant la première.
  let clock = 1_000_000;
  const sleeps = [];
  const { calls, fetchImpl } = fake([json([]), json([]), json([{ lat: '50.85', lon: '4.35' }])]);
  const geocode = createNominatimGeocoder({
    fetchImpl,
    minGapMs: 1100,
    now: () => clock,
    sleep: async (ms) => { sleeps.push(ms); clock += ms; },
  });
  await geocode(toison);
  assert.equal(calls.length, 3);
  assert.deepEqual(sleeps, [1100, 1100]);
  // Du temps s'est déjà écoulé : on n'attend que le complément.
  clock += 400;
  const next = fake([json([{ lat: '50.85', lon: '4.35' }])]);
  await createNominatimGeocoder({ fetchImpl: next.fetchImpl, minGapMs: 1100, now: () => clock, sleep: async (ms) => { sleeps.push(ms); clock += ms; } })(toison);
  assert.equal(sleeps.length, 2); // un nouveau géocodeur démarre sans attente
}
console.log('ok');
