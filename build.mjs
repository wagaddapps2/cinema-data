/**
 * Génère un fichier par pays dans public/ : kw.json, ae.json, sa.json… (GitHub Pages).
 *  - Pays avec sites officiels (OFFICIAL) : on lit uniquement ces sites.
 *  - Tous les autres pays d'elCinema : repli sur elCinema, SEULEMENT s'ils n'ont aucun site officiel ici.
 * Un site en panne ne bloque pas les autres : ses données reprennent celles du dernier fichier publié
 * (PREVIOUS_BASE). L'exécution n'échoue que si aucun fichier n'a pu être produit.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fetchCinebel } from './cinebel.mjs';
import { fetchCinescapeViaElcinema } from './cinescape-elcinema.mjs';
import { COUNTRIES, fetchElcinemaCountry } from './elcinema.mjs';
import { fetchGrand } from './grand.mjs';
import { fetchLinternaute } from './linternaute.mjs';
import { fetchOzone } from './ozone.mjs';
import { fetchSky } from './sky.mjs';
import { fetchVox } from './vox.mjs';

const env = (k, d) => (process.env[k] || d).replace(/\/+$/, '');
const PREVIOUS_BASE = process.env.PREVIOUS_BASE;
const nonEmpty = (feed) => { if (!Object.values(feed).some((c) => c.films.length > 0)) throw new Error('aucun film lu'); return feed; };

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
    { name: 'linternaute', prefix: 'linternaute-', run: async () => nonEmpty(await fetchLinternaute()) },
  ],
  be: [
    { name: 'cinebel', prefix: 'cinebel-', run: async () => nonEmpty(await fetchCinebel()) },
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
      Object.assign(cinemas, await s.run());
      ok++;
    } catch (e) {
      console.warn(`::warning::${cc}/${s.name} en échec (${e.message}) — données précédentes conservées`);
      for (const [k, v] of Object.entries(previous)) if (k.startsWith(s.prefix)) cinemas[k] = v;
    }
  }
  if (Object.keys(cinemas).length === 0) { console.warn(`::warning::${cc} : rien à publier`); continue; }
  writeFileSync(`public/${cc}.json`, JSON.stringify({ updatedAt: new Date().toISOString(), territory: cc.toUpperCase(), cinemas }, null, 1));
  console.log(`${cc}.json : ${Object.keys(cinemas).length} cinéma(s), ${ok}/${sources.length} source(s) ok`);
  written++;
}
if (written === 0) throw new Error("Aucun fichier produit : on ne publie rien.");
