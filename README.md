# cinema-data

Collecte les films à l'affiche / à venir des cinémas du Koweït (sites officiels) et, pour les autres pays, d'elCinema.
Sortie : `public/<pays>.json` (GitHub Pages), lue par l'app. Aucune heure de séance n'est conservée.

- `vox.mjs`, `grand.mjs`, `ozone.mjs`, `sky.mjs` : sites officiels du Koweït.
- `linternaute.mjs` : France (Linternaute) : **une entrée par salle** des 11 grandes villes (Paris, Marseille, Lyon, Toulouse,
  Nice, Nantes, Montpellier, Strasbourg, Bordeaux, Lille, Rennes). La page d'une ville liste ses salles deux par deux
  (`?page=N`, une quarantaine de pages pour Paris) : nom, adresse, films du jour et versions (VF/VO) ; aucun horaire.
  `city` est le nom de la grande ville (l'app filtre par ville). Adresse et coordonnées comme pour la Belgique (Nominatim,
  une fois par salle). Une salle absente d'une collecte garde ses données 3 jours au plus ; si aucune salle n'est
  reconnue (le site a changé), on revient à la liste nationale (une seule entrée « tout le pays »).
- `cinebel.mjs` : Belgique (Cinebel, La DH) : **une entrée par salle**, avec sa ville et son enseigne (les ~66 salles du
  menu « Cinéma », puis la page de chaque salle : films de la semaine, versions VF/VO/NV, âge conseillé ; aucun horaire).
  Les 35 pages de « films à l'affiche » donnent titres originaux et dates de sortie. Une salle illisible (erreur, ou page
  sans adresse ni film, comme un contrôle anti-robot) est relue une fois, puis garde ses données précédentes 3 jours au
  plus. Si moins de la moitié des salles sont connues, l'entrée nationale est ajoutée (repli). Les chaînes regroupées
  par l'app sont listées dans `CHAINS`.
  **Coordonnées** : chaque salle qui a des films publie aussi son `address` et ses `lat`/`lng` (l'app trie les salles
  par distance, bouton « Près de moi »). `geocode.mjs` les cherche auprès de Nominatim (OpenStreetMap) **une seule fois
  par salle** : la collecte suivante reprend celles du dernier fichier publié tant que l'adresse ne change pas. Une
  requête par seconde au plus ; après 3 échecs de suite la recherche est suspendue jusqu'à la collecte suivante ; une
  salle introuvable reste publiée sans coordonnées. `GEOCODER_URL` change de service, `GEOCODER_URL=off` le désactive.
- `elcinema.mjs` : repli pour les pays SANS site officiel ici (ajouter un pays à `OFFICIAL` dans `build.mjs` le retire du repli).
- `cinescape-elcinema.mjs` : **Cinescape Kuwait**, lu via les pages de ses salles sur elCinema (titres seulement), car
  le site officiel bloque les robots. C'est une exception à la règle « elCinema seulement sans site officiel ».
- `cinescape.mjs` : lecteur du site officiel, écrit et testé sur une page enregistrée, mais **désactivé** : le site répond 403 (Cloudflare) aux accès
  automatiques. Ne pas contourner la protection ; demander un accès (API/partenariat) à Cinescape / KNCC.

Tests : `node <site>.test.mjs` (les pages enregistrées sont dans `test-fixtures/`, non versionné ; pour la Belgique :
`cinebel_films.html` et `cinebel_cinema.html`, extrait d'une page de salle ; pour la France : `linternaute.html`,
`lint_hub.html`, `lint_dep43.html`, `lint_paris.html`, `lint_marseille.html` ; `node geocode.test.mjs` pour les coordonnées).
