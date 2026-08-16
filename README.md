# PAF — Prévisions

Tableau de bord de prévision d'affluence pour **La Petite Auberge de Flo**
(Saint-Bonnet-les-Oules), et le SQL qui l'alimente.

Volontairement séparé du dépôt du site (`LaPaF`) : ce dépôt n'est pas déployé,
le dashboard n'a donc pas d'URL publique. On l'ouvre depuis son disque.

## Ouvrir le dashboard

```bash
# double-clic sur index.html, ou :
python3 -m http.server 8080   # puis http://localhost:8080
```

Connexion avec le compte du dashboard chef (le même que `admin.html` du site).
`persistSession: false` : rien n'est écrit dans le navigateur, il faut se
reconnecter à chaque ouverture. C'est volontaire.

## Ce qu'il montre

- cinq indicateurs (demandes reçues, couverts confirmés, prévision 7 jours, taux de refus, demandes en attente)
- la prévision des 14 prochains jours, par service, avec le niveau déjà réservé
- le profil de la semaine (moyenne par jour × service)
- la demande semaine après semaine
- les demandes refusées, par jour et service

Mode clair / sombre, infobulles souris et clavier, vue tableau sous le graphique
de prévision.

## ⚠️ Ce que ces chiffres ne sont pas

Ils ne portent **que sur les réservations passées par le site**. Ni le téléphone,
ni les clients qui poussent la porte. Les moyennes observées tournent à 2–3
couverts par service, très en dessous de la salle réelle.

C'est donc un indicateur de la **demande en ligne** — utile pour repérer les
créneaux qui saturent et les demandes perdues — pas un outil de commande pour la
cuisine.

Pour prédire la salle, il faut alimenter la table `service_realise` (couverts
réellement servis, saisis en fin de service). La vue et la fonction de prévision
basculent automatiquement dessus dès qu'elle contient des lignes, et la colonne
`fiabilite` passe de `reservations_seules` à `partielle` puis `bonne`.

## Backend

Projet Supabase `pmuczxviazbvfmvfqzlk` — le même que le site et le dashboard chef.
Le dossier `sql/` contient les objets créés pour les prévisions, dans l'ordre
d'application. Ils sont déjà appliqués en production ; ces fichiers servent de
référence et de trace.

| Fichier | Objet |
|---|---|
| `sql/01_rate_limit_reservations.sql` | Anti-spam serveur sur les insertions publiques |
| `sql/02_service_realise.sql` | Table des couverts réellement servis (vide à ce jour) |
| `sql/03_v_service_activite.sql` | Vue d'historique par date + service |
| `sql/04_get_previsions.sql` | Fonction de prévision |

Tous ces objets sont réservés au chef authentifié (`security_invoker` + RLS).
Le rôle `anon` n'a accès à aucun chiffre de salle.

## Méthode de prévision

Moyenne pondérée des **8 dernières occurrences du même jour de semaine et du même
service**, les plus récentes pesant plus (facteur 0,85 par rang). La prévision ne
descend jamais sous ce qui est déjà réservé, et les jours de fermeture sont exclus.

Volontairement simple : avec quelques mois d'historique et un restaurant de
village, un modèle plus sophistiqué serait du bruit habillé en précision. La
colonne `fiabilite` dit ce que vaut chaque ligne plutôt que de faire semblant.
