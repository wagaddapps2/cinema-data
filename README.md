# cinema-data

Collecte les films à l'affiche / à venir des cinémas du Koweït (sites officiels) et, pour les autres pays, d'elCinema.
Sortie : `public/<pays>.json` (GitHub Pages), lue par l'app. Aucune heure de séance n'est conservée.

- `vox.mjs`, `grand.mjs`, `ozone.mjs`, `sky.mjs` : sites officiels du Koweït.
- `linternaute.mjs` : France (Linternaute) : 11 grandes villes, et les arrondissements de Paris/Marseille/Lyon (les pages de ville ne les regroupent pas).
- `cinebel.mjs` : Belgique (Cinebel, La DH) : **une entrée par salle**, avec sa ville et son enseigne (les ~66 salles du
  menu « Cinéma », puis la page de chaque salle : films de la semaine, versions VF/VO/NV, âge conseillé ; aucun horaire).
  Les 35 pages de « films à l'affiche » donnent titres originaux et dates de sortie. Une salle illisible (erreur, ou page
  sans adresse ni film, comme un contrôle anti-robot) est relue une fois, puis garde ses données précédentes 3 jours au
  plus. Si moins de la moitié des salles sont connues, l'entrée nationale est ajoutée (repli). Les chaînes regroupées
  par l'app sont listées dans `CHAINS`.
- `elcinema.mjs` : repli pour les pays SANS site officiel ici (ajouter un pays à `OFFICIAL` dans `build.mjs` le retire du repli).
- `cinescape-elcinema.mjs` : **Cinescape Kuwait**, lu via les pages de ses salles sur elCinema (titres seulement), car
  le site officiel bloque les robots. C'est une exception à la règle « elCinema seulement sans site officiel ».
- `cinescape.mjs` : lecteur du site officiel, écrit et testé sur une page enregistrée, mais **désactivé** : le site répond 403 (Cloudflare) aux accès
  automatiques. Ne pas contourner la protection ; demander un accès (API/partenariat) à Cinescape / KNCC.

Tests : `node <site>.test.mjs` (les pages enregistrées sont dans `test-fixtures/`, non versionné ; pour la Belgique :
`cinebel_films.html` et `cinebel_cinema.html`, extrait d'une page de salle).
