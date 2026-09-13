# Comment signaler un événement du jour (soirée karaoké, etc.)

Un seul fichier à toucher : **`evenement-du-jour.js`**, à la racine du dossier
`site-auberge-flo-v2.1/`. Rien d'autre à modifier.

## Ce que ça change quand c'est activé

- Un bandeau **ancré en haut de l'écran** (reste visible même en descendant dans la
  page) apparaît sur `index.html`, `reservation.html` **et** `admin.html` (le cahier du
  chef), avec le texte que tu écris.
- La photo de l'événement entre dans le carrousel de la page d'accueil (hero), à côté
  de la photo habituelle de la façade.
- Une **popup** avec la photo en grand + le nom de la soirée + un bouton "Réserver une
  table" s'affiche automatiquement à l'arrivée sur `index.html` — une seule fois par
  visite (elle ne réapparaît pas si on change de page puis revient sur l'accueil dans la
  même visite). Le petit texte au-dessus de la photo ("— Ce soir —" ou la date) se
  calcule tout seul à partir du champ `date`, tu n'as rien à écrire pour ça.
- Sur `reservation.html`, si le visiteur choisit **la même date** que le champ `date`
  ci-dessous, une note apparaît sous le champ pour le prévenir que c'est une soirée à
  thème ce jour-là.

## Étapes

1. Ouvre `evenement-du-jour.js` dans un éditeur de texte (ou demande à Claude de le
   faire pour toi : *"active l'événement du jour, c'est une soirée karaoké le 26
   septembre"*).
2. Modifie les 5 champs en haut du fichier :

```js
window.EVENEMENT_DU_JOUR = {
  actif: true,                              // false = rien ne s'affiche
  date: "2026-09-26",                       // format AAAA-MM-JJ, obligatoire
  nom: "Soirée Karaoké",                    // sert de texte alternatif sur la photo
  image: "assets/events/karaoke.webp",      // le chemin d'une photo qui existe déjà dans assets/events/
  texte_bandeau: "🎤 Samedi 26 Septembre : Soirée Karaoké — animation dès 20h",
};
```

**Sur `texte_bandeau`, à toi de choisir la formulation** (c'est le seul champ que le
site n'interprète pas) :
- Si tu annonces l'événement **à l'avance** (plusieurs jours avant, comme pour donner
  envie de réserver) : écris la date en toutes lettres, ex. *"Samedi 26 Septembre :
  Soirée Karaoké..."* — sinon le bandeau dirait "ce soir" pour un événement dans 2
  semaines, ce qui est faux.
- Si tu actives **le jour même** : *"Ce soir : Soirée Karaoké..."* fonctionne très bien.

La popup et la note de réservation, elles, n'ont pas ce problème : elles regardent le
champ `date` et savent toutes seules si c'est aujourd'hui ou plus tard.

3. Enregistre le fichier.
4. **Une fois l'événement passé, repasse `actif` à `false`.**
   Rien ne l'éteint tout seul — c'est volontaire, pour rester simple.

## Photos disponibles

Le dossier `assets/events/` contient déjà : `karaoke.webp`, `paella.webp`,
`basque.webp`, `huitres.webp`, `cochon.webp` (et `foie-gras.mp4`, une vidéo — ne pas la
mettre dans `image`, ce champ attend une photo).

Pour un événement qui n'a pas encore de photo : ajoute le fichier dans
`assets/events/` puis réfère-toi à son chemin dans `image`.

## Vérifier avant de considérer que c'est en ligne

Ce dossier (`site-auberge-flo-v2.1/`) est une **copie de travail**, pas encore le site
réellement en ligne (voir `.claude/memory/primer.md` pour le détail de la situation
git). Pour prévisualiser en local avant toute mise en ligne :

```bash
cd "site-auberge-flo-v2.1"
python3 -m http.server 8767
# puis ouvrir http://localhost:8767/
```

Si tu as déjà ouvert `admin.html` dans ce même navigateur avant de tester une page
publique, force un vrai rechargement (cmd+shift+R) ou ouvre une fenêtre privée — le
cahier installe un cache (PWA) qui peut, une fois posé, servir une version périmée des
autres pages du même site dans ce navigateur.

## Un décalage possible côté cahier du chef (`admin.html`)

Les pages publiques (`index.html`, `reservation.html`) n'ont pas de mise en cache :
ton édition est visible dès le rechargement de la page, pour tout le monde.

`admin.html` est une PWA avec un cache (`sw.js`, cache-first). Après une modification
de `evenement-du-jour.js`, le chef doit **quitter et rouvrir l'app** (ou faire glisser
pour rafraîchir) pour voir le bandeau à jour dans son cahier — un simple retour sur
l'onglet ne suffit pas forcément. Prévenir la chef par téléphone reste le moyen le plus
sûr le jour même.

## Erreurs à éviter

- Ne pas modifier le fichier `evenement-du-jour.js` du dossier `site-auberge-flo-v2/`
  (sans le `.1`) — c'est l'ancienne copie, elle n'existe même pas là-bas pour l'instant
  et ce n'est plus le chantier actif.
- Ne pas laisser `actif: true` en permanence : le bandeau et la 2ᵉ photo du carrousel
  resteraient affichés en dehors de tout événement.
- Le champ `image` doit pointer vers un fichier qui existe réellement dans
  `assets/events/` — une faute de frappe n'affiche pas d'erreur visible, la photo est
  juste absente du carrousel.
