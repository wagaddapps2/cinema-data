/**
 * Génère un fichier par pays dans public/ : kw.json, ae.json, sa.json… (GitHub Pages).
 *  - Pays avec sites officiels (OFFICIAL) : on lit uniquement ces sites.
 *  - Tous les autres pays d'elCinema : repli sur elCinema, SEULEMENT s'ils n'ont aucun site officiel ici.
 * Un site en panne ne bloque pas les autres : ses données reprennent celles du dernier fichier publié
 * (PREVIOUS_BASE). Une source peut aussi recevoir ces données précédentes (run(previous)) pour ne remplacer
 * que ce qu'elle a pu relire. L'exécution n'échoue que si aucun fichier n'a pu être produit.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fetchCinebel, restoredCinema } from './cinebel.mjs';
import { fetchCinescapeViaElcinema } from './cinescape-elcinema.mjs';
import { COUNTRIES, fetchElcinemaCountry } from './elcinema.mjs';
import { createNominatimGeocoder } from './geocode.mjs';
import { fetchGrand } from './grand.mjs';
import { fetchLinternaute, isNationalEntry } from './linternaute.mjs';
import { fetchOzone } from './ozone.mjs';
import { fetchSky } from './sky.mjs';
import { fetchVox } from './vox.mjs';

const env = (k, d) => (process.env[k] || d).replace(/\/+$/, '');
const PREVIOUS_BASE = process.env.PREVIOUS_BASE;
const nonEmpty = (feed) => { if (!Object.values(feed).some((c) => c.films.length > 0)) throw new Error('aucun film lu'); return feed; };
/** Géocodeur des salles (Nominatim) ; GEOCODER_URL=off le désactive (aucune requête de localisation). */
const geocoder = () => (/^off$/i.test(process.env.GEOCODER_URL ?? '') ? undefined : createNominatimGeocoder());

/** Pays -> sites officiels. Ajouter un pays ici le retire automatiquement du repli elCinema. */
const OFFICIAL = {
  kw: [
    { name: 'vox', prefix: 'vox-', run: async () => { const v = await fetchVox(); if (!v.whatsOn.length) throw new Error('aucun film lu'); return { 'vox-kw': { name: 'VOX Cinemas Kuwait', films: [...v.whatsOn, ...v.comingSoon] } }; } },
    { name: 'grand', prefix: 'grand-', run: async () => nonEmpty(await fetchGrand(env('GRAND_BASE_URL', 'https://kw.grandcinemasme.com'))) },
    { name: 'ozone', prefix: 'ozone-', run: async () => nonEmpty(await fetchOzone(env('OZONE_BASE_URL', 'https://www.ozonecinema.com'))) },
    // Cinescape : son site officiel bloque les robots (Cloudflare) -> on lit les pages de ses salles sur elCinema (titres seulement).
    { name: 'cinescape', prefix: 'cinescape-', run: () => fetchCinescapeViaElcinema() },
    { name: 'sky', prefix: 'sky-', run: async () => nonEmpty(await fetchSky(env('SKY_BASE_URL', 'https://www.skycinemaskw.com'))) },
  ],
  fr: [
    // Une entrée par salle des grandes villes, avec sa ville, son adresse et sa position (cherchée une fois par salle).
    // `restore` : en cas de panne complète, les salles gardent leurs données 3 jours ; l'ancienne entrée nationale reste.
    { name: 'linternaute', prefix: 'linternaute-', run: async (previous) => nonEmpty(await fetchLinternaute(undefined, { previous, geocode: geocoder() })), restore: (entry) => restoredCinema(entry) ?? (isNationalEntry(entry) ? entry : null) },
  ],
  be: [
    // Une entrée par salle (66 salles listées par Cinebel) ; une salle illisible garde ses données précédentes.
    // `restore` : en cas de panne complète, les données précédentes ne sont gardées que 3 jours, statuts mis à jour.
    // Coordonnées des salles (tri par distance dans l'app) : cherchées une fois par salle, ensuite reprises du fichier publié.
    // GEOCODER_URL=off les désactive (aucune requête de localisation).
    { name: 'cinebel', prefix: 'cinebel-', run: async (previous) => nonEmpty(await fetchCinebel(undefined, { previous, geocode: geocoder() })), restore: (entry) => restoredCinema(entry) },
  ],
};

const territories = { ...OFFICIAL };
for (const cc of Object.keys(COUNTRIES)) {
  if (!(cc in OFFICIAL)) territories[cc] = [{ name: `elcinema-${cc}`, prefix: 'elcinema-', run: () => fetchElcinemaCountry(cc) }];
}

mkdirSync('public', { recursive: true });
let written = 0;
for (const [cc, sources] of Object.entries(territories)) {
  let previous = {};
  if (PREVIOUS_BASE) {
    try { previous = (await (await fetch(`${PREVIOUS_BASE}/${cc}.json`)).json()).cinemas ?? {}; } catch { /* premier passage */ }
  }
  const cinemas = {};
  let ok = 0;
  for (const s of sources) {
    try {
      Object.assign(cinemas, await s.run(previous));
      ok++;
    } catch (e) {
      console.warn(`::warning::${cc}/${s.name} en échec (${e.message}) — données précédentes conservées`);
      for (const [k, v] of Object.entries(previous)) {
        if (!k.startsWith(s.prefix)) continue;
        const kept = s.restore ? s.restore(v) : v;
        if (kept) cinemas[k] = kept;
      }
    }
  }
  if (Object.keys(cinemas).length === 0) { console.warn(`::warning::${cc} : rien à publier`); continue; }
  writeFileSync(`public/${cc}.json`, JSON.stringify({ updatedAt: new Date().toISOString(), territory: cc.toUpperCase(), cinemas }, null, 1));
  console.log(`${cc}.json : ${Object.keys(cinemas).length} cinéma(s), ${ok}/${sources.length} source(s) ok`);
  written++;
}
if (written === 0) throw new Error("Aucun fichier produit : on ne publie rien.");
