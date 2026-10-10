/** Génère public/kuwait.json (à publier tel quel : GitHub Pages / Cloudflare Pages). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fetchVox } from './vox.mjs';

const vox = await fetchVox();
if (vox.whatsOn.length === 0) throw new Error('VOX : aucune page lue, le site a peut-être changé — on ne publie pas un fichier vide.');

mkdirSync('public', { recursive: true });
writeFileSync(
  'public/kuwait.json',
  JSON.stringify({ updatedAt: new Date().toISOString(), territory: 'KW', cinemas: { 'vox-kw': { name: 'VOX Cinemas Kuwait', films: [...vox.whatsOn, ...vox.comingSoon] } } }, null, 1),
);
console.log(`kuwait.json : ${vox.whatsOn.length} à l'affiche, ${vox.comingSoon.length} à venir`);
