# Conception de l'API — Salle de sport

Lucas PEREZ — ESGI 3ᵉ année (3ESGI-AL), Campus Skolae — module Web API, 2026–2027.

Périmètre : séances 1 à 4.

## Ressources et modèle de données

| Collection     | Attributs principaux                                       | Relations                                            |
| -------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| adherents      | id, nom, email                                             | Possède des abonnements et effectue des réservations |
| abonnements    | id, adherent_id, formule, debut, fin, quota_hebdo          | N abonnements successifs pour un adhérent            |
| coachs         | id, nom, email                                             | Anime plusieurs cours                                |
| cours          | id, type, coach_id, capacite, règle de récurrence, version | Un coach ; plusieurs créneaux                        |
| creneaux       | id, cours_id, debut, fin, capacite                         | Une occurrence datée ; plusieurs réservations        |
| reservations   | id, adherent_id, creneau_id, statut, cree_le, motif        | Relie un adhérent à un créneau                       |
| listes_attente | id, adherent_id, creneau_id, cree_le, rang, statut, motif  | Vue des réservations en attente ou retirées          |

Les relations cours–créneaux et adhérents–abonnements sont 1–N.
Les adhérents et créneaux sont liés en N–N au fil des réservations.
Les instants sont stockés en `TIMESTAMPTZ`, rendus au format ISO ; les dates
contractuelles d'abonnement sont des dates civiles. Le calendrier métier est Paris.

Les places prises/restantes et le rang d'attente sont calculés. La capacité du
créneau est stockée comme engagement propre à cette occurrence. La version du
cours est stockée pour le contrôle conditionnel.

## Tableau HTTP

Toutes les erreurs sont en `application/problem+json`. Les écritures JSON peuvent
également renvoyer 413 (taille) et 415 (type de contenu). Les paramètres invalides
renvoient 400. Un conflit transactionnel durable peut renvoyer 503 + Retry-After.

| Opération              | Méthode et URI                   | Succès                 | Erreurs principales     |
| ---------------------- | -------------------------------- | ---------------------- | ----------------------- |
| Lister les adhérents   | GET /adherents                   | 200                    | 400                     |
| Lire un adhérent       | GET /adherents/{id}              | 200                    | 400, 404                |
| Créer un adhérent      | POST /adherents                  | 201 + Location         | 400, 422, 409           |
| Remplacer un adhérent  | PUT /adherents/{id}              | 200                    | 400, 422, 404, 409      |
| Modifier un adhérent   | PATCH /adherents/{id}            | 200                    | 400, 422, 404, 409      |
| Supprimer un adhérent  | DELETE /adherents/{id}           | 204 vide               | 400, 404, 409           |
| Lister les cours       | GET /cours                       | 200                    | 400                     |
| Lire un cours          | GET /cours/{id}                  | 200 + ETag ou 304 vide | 400, 404                |
| Créer un cours         | POST /cours                      | 201 + Location + ETag  | 400, 422, 404           |
| Remplacer un cours     | PUT /cours/{id}                  | 200 + ETag             | 400, 422, 404, 409, 412 |
| Modifier un cours      | PATCH /cours/{id}                | 200 + ETag             | 400, 422, 404, 409, 412 |
| Supprimer un cours     | DELETE /cours/{id}               | 204 vide               | 400, 404, 409, 412      |
| Lister le planning     | GET /creneaux                    | 200                    | 400                     |
| Lire un créneau        | GET /creneaux/{id}               | 200                    | 400, 404                |
| Lister les occurrences | GET /cours/{id}/creneaux         | 200                    | 400, 404                |
| Créer une occurrence   | POST /cours/{id}/creneaux        | 201 + Location         | 400, 422, 404           |
| Réserver               | POST /creneaux/{id}/reservations | 201 + Location         | 400, 422, 404, 409      |
| Lire l'historique      | GET /reservations                | 200                    | 400                     |
| Lire une réservation   | GET /reservations/{id}           | 200                    | 400, 404                |
| Annuler                | PATCH /reservations/{id}         | 200                    | 400, 422, 404, 409      |
| Lister les attentes    | GET /listes_attente              | 200                    | 400                     |
| Lire une attente       | GET /listes_attente/{id}         | 200                    | 400, 404                |
| Retirer une attente    | DELETE /listes_attente/{id}      | 204 vide               | 400, 404, 409           |
| Lister les abonnements | GET /abonnements                 | 200                    | 400                     |
| Lister les coachs      | GET /coachs                      | 200                    | 400                     |

## Écritures et validation

Adhérent : `nom` non vide, maximum 100 caractères ; email valide, maximum 254,
normalisé en minuscules, unique. POST et PUT exigent les deux champs.
PATCH exige au moins un champ et conserve les autres.

Cours : `type`, `coach_id`, `capacite`, `jour_semaine`, `heure_debut`, `duree_min`,
`periode_debut`, `periode_fin`, `fuseau`. POST et PUT exigent tous les champs.
La capacité est entre 1 et 1000 ; le jour entre 1 et 7 ; la durée entre 1 et 1440
minutes ; les dates sont valides et ordonnées ; le fuseau accepté est Europe/Paris.
Le coach doit exister. PATCH revalide l'ensemble après fusion avec les valeurs
actuelles, pour contrôler notamment les dates.

Créneau : `debut`, `fin` ISO avec fuseau ; fin après début ; durée conforme au cours
et début dans sa période. Les occurrences sont explicites et peuvent déroger à
son jour/heure de récurrence. La capacité est copiée du cours.

Réservation : `{ "adherent_id": 12 }`. Annulation : `{ "statut": "annulee" }`.
Les identifiants du corps sont des nombres entiers positifs ; ceux des URL et query
strings sont convertis et validés. Tous les schémas rejettent les champs inconnus.

Un PUT incomplet est refusé en 422 : tous les champs métier sont obligatoires.
Un PATCH ne modifie que les champs fournis. Les identifiants et versions ne sont
jamais acceptés comme champs modifiables.

## Navigation

Toutes les collections renvoient `data`, `pagination` et `links`.
Offset : `page=1`, `limit=20` par défaut, limite de 100 et page maximale 100000.
`links.next` et `links.prev` valent une URI relative ou null et conservent les filtres.

```http
GET /creneaux?coach=8&jour=2026-10-06&tri=debut,id&ordre=asc&page=1&limit=2
```

Avec le kit, cet exemple renvoie les créneaux 6 et 8, puis 9 en page 2 : les créneaux
8 et 9 commencent tous deux à 10:15 et l'id les départage.
Les filtres sont optionnels et combinables ; `jour` est une date de Paris.
`from` inclusif et `to` exclusif filtrent les instants de début.
Tris acceptés : `debut,id` (défaut), `fin,id`, `id` ; ordre asc ou desc.
Les autres collections offset sont ordonnées par identifiant, ou par créneau puis
ordre d'attente pour les listes d'attente.

```http
GET /reservations?limit=10&adherent=1
GET /reservations?limit=10&after=<curseur>
GET /reservations?page=1&limit=10
```

L'historique est trié par `cree_le,id` décroissant. `after` encode ces deux valeurs
en JSON base64url. C'est une position, pas une protection cryptographique.
Le client doit suivre `links.next` sans le reconstruire. Il peut filtrer par
`adherent` et `creneau`. Le mode offset explicite avec `page` sert notamment à
montrer le décalage dû à une insertion ; `page` et `after` sont incompatibles.

Une insertion avant la position ne décale pas la suite par curseur. Cela ne donne
pas un snapshot : les données plus récentes nécessitent un nouveau parcours.

## Règles de réservation

La fenêtre commence sept jours **calendaires à Paris** avant le début et se termine
au début exclu. Un abonnement doit couvrir la date locale du créneau. Les périodes
sont inclusives et ne peuvent pas se chevaucher pour un même adhérent.
Le quota compte les confirmations de la semaine du cours (lundi à dimanche Paris),
quelle que soit la date à laquelle la réservation a été effectuée.
La formule `illimite` n'a pas de plafond : le 7 du kit n'est pas appliqué comme quota.

La même éligibilité est exigée pour entrer en attente. Si le créneau est plein,
une réservation `en_attente` est créée et Location pointe vers `/listes_attente/{id}`.
Sinon, elle est `confirmee` et Location pointe vers `/reservations/{id}`.
L'attente ne consomme pas le quota. L'unicité porte sur les deux états actifs.

L'annulation reste dans l'historique et libère le quota. Avant le début du créneau,
elle peut promouvoir le premier adhérent encore éligible. Les attentes devenues
inéligibles sont retirées avec motif. Répéter une annulation retourne l'état annulé
sans nouvelle promotion. Une inscription promue conserve le même identifiant,
consultable dans `/reservations/{id}`.

## Erreurs normalisées

```json
{
  "type": "urn:salle-de-sport:problem:validation",
  "title": "Requête invalide",
  "status": 422,
  "detail": "Corrigez les champs indiqués.",
  "instance": "/adherents",
  "errors": [
    { "field": "nom", "message": "..." },
    { "field": "email", "message": "..." }
  ]
}
```

400 concerne la syntaxe JSON ou les paramètres mal formés. 422 concerne les champs
d'un corps lisible. 409 concerne un conflit avec l'état courant : doublon, quota,
abonnement ou fenêtre. Ce choix pour le quota et la fenêtre diffère de l'exemple de S3 mais suit
la distinction explicitée en S4 : la même intention pourrait réussir dans un autre
état. Aucune stack trace ni message SQL interne n'est exposé.

## Stratégie face au piège de concurrence

### Le piège

Deux clients peuvent lire une place disponible avant d'insérer tous les deux.
Un adhérent peut aussi réserver deux créneaux différents en parallèle alors qu'il
ne lui reste qu'une unité de quota. Une vérification sans transaction ne suffit pas.

### Ce que fait l'API

Une transaction sérialisable verrouille le créneau puis l'adhérent, vérifie les
règles et décide confirmation ou attente. Le doublon actif est aussi empêché par
un index unique partiel. Les échecs de sérialisation sont repris entièrement.
Les promotions suivent les mêmes garanties. Voir `architecture.md`.

Deux adhérents sur la dernière place donnent une confirmation et une attente.
Deux demandes du même adhérent donnent une création et un 409 problem+json.
Deux demandes sur des créneaux différents ne peuvent dépasser son quota.

Les cours utilisent ETag pour le cache et la prévention des écrasements :
If-None-Match identique donne 304 vide ; If-Match obsolète donne 412.
Comparaison et modification sont atomiques. If-Match reste facultatif.

### Pourquoi REST ici

Les adhérents, cours et réservations sont des ressources identifiables par URI.
La sémantique HTTP décrit les lectures, créations et conflits ; le cache conditionnel
et les clients HTTP existants sont directement utilisables. Le design vise le
niveau 2 de Richardson, complété par les liens de navigation des collections.

### Conséquences

Le client doit distinguer confirmation et attente même avec un 201, exploiter
Location, suivre les liens de pagination et relire un cours après un 412.
Une reprise réseau d'un POST n'est pas garantie idempotente : si la première demande
a abouti, le doublon actif sera refusé. Le client peut consulter ses inscriptions.
Le système ne gère ni authentification, ni notifications, ni expiration automatique
des attentes dans le périmètre choisi.

## Choix de conception justifiés

1. Les réservations ont une URI propre car leur historique se consulte aussi bien
   côté adhérent que côté créneau ; leur création est contextualisée sous le créneau.
2. Annuler est un PATCH d'état afin de préserver l'historique. L'attente utilise le
   même stockage pour permettre une contrainte d'unicité commune et une promotion atomique.
3. La pagination offset convient au planning ; le curseur convient à un historique
   qui reçoit des insertions récentes pendant sa lecture.
