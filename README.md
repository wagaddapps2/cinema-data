# cinema-data

Collecte les films à l'affiche / à venir des cinémas du Koweït (sites officiels) et, pour les autres pays, d'elCinema.
Sortie : `public/<pays>.json` (GitHub Pages), lue par l'app. Aucune heure de séance n'est conservée.

- `vox.mjs`, `grand.mjs`, `ozone.mjs`, `sky.mjs` : sites officiels du Koweït.
- `linternaute.mjs` : France (Linternaute) : 11 grandes villes, et les arrondissements de Paris/Marseille/Lyon (les pages de ville ne les regroupent pas).
- `cinebel.mjs` : Belgique (Cinebel, La DH), 35 pages de « films à l'affiche » ; titre français + titre original.
- `elcinema.mjs` : repli pour les pays SANS site officiel ici (ajouter un pays à `OFFICIAL` dans `build.mjs` le retire du repli).
- `cinescape-elcinema.mjs` : **Cinescape Kuwait**, lu via les pages de ses salles sur elCinema (titres seulement), car
  le site officiel bloque les robots. C'est une exception à la règle « elCinema seulement sans site officiel ».
- `cinescape.mjs` : lecteur du site officiel, écrit et testé sur une page enregistrée, mais **désactivé** : le site répond 403 (Cloudflare) aux accès
  automatiques. Ne pas contourner la protection ; demander un accès (API/partenariat) à Cinescape / KNCC.

Tests : `node <site>.test.mjs` (les pages enregistrées sont dans `test-fixtures/`, non versionné).
