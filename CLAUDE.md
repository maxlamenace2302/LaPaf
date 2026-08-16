# paf-previsions — tableau de bord de prévision (client LA PAF)

Dépôt séparé du site. Ne **jamais** le fusionner dans `site-auberge-flo-v2` :
ce dépôt-là est publié tel quel (`publish = "."`), tout fichier ajouté à sa
racine devient une URL publique.

## Périmètre (cadré par Max le 2026-08-16)
« Le projet de réservation » = **backend Supabase + dashboard chef**. Les pages
publiques du site ne se touchent pas sans demande explicite.

## Stack
- `index.html` — page autonome, aucune dépendance hors `@supabase/supabase-js`
  chargé depuis esm.sh. CSS et JS inline, SVG dessiné à la main (pas de lib de
  graphiques).
- `sql/` — les objets Supabase, déjà appliqués en prod, versionnés ici pour trace.

## Règles
- Palette data-viz validée (bleu `#2a78d6` midi / orange `#eb6834` soir en clair,
  `#3987e5` / `#d95926` en sombre) — elle passe tous les tests de séparation
  daltonisme. Ne pas la changer sans revalider.
- Les textes affichés viennent de la base : toujours les insérer avec
  `textContent`, jamais par concaténation `innerHTML`.
- `persistSession: false` — ne jamais activer la persistance de session ici.
- L'avertissement en tête du dashboard (« ces chiffres ne couvrent que les
  réservations en ligne ») reste tant que `service_realise` est vide.

## Liens
- Site + dashboard chef : `../site-auberge-flo-v2/` (dépôt `maxlamenace2302/LaPaF`)
- Refonte v3 : `../site-auberge-flo-v3/`
- Univers client : `../CLAUDE.md`
