# Architecture et garanties

## Organisation

Le projet est un monolithe modulaire : une seule application et une seule base,
avec quatre domaines. La séparation suit les responsabilités utiles au projet.

| Élément               | Responsabilité                                 | Dépendances                        |
| --------------------- | ---------------------------------------------- | ---------------------------------- |
| Route                 | Valider les entrées et adapter la réponse HTTP | Schémas, service, utilitaires HTTP |
| Service               | Orchestrer le cas d'usage et ses transactions  | Repositories, règles métier        |
| Repository            | Exécuter du SQL paramétré                      | Connexion PostgreSQL fournie       |
| Règles de réservation | Calculer fenêtre, semaine et quota             | Horloge fournie, calendrier Paris  |

`app.ts` assemble explicitement les dépendances. `server.ts` lit la configuration,
contrôle la connexion, écoute et ferme les connexions à l'arrêt. Les tests appellent
la même fabrique d'application, puis ouvrent un véritable serveur sur un port libre.
Les erreurs applicatives sont traduites en HTTP par un handler commun.

Les schémas déclaratifs rejettent les champs inconnus et remontent tous les champs
invalides. Une validation métier nécessitant la base reste dans le service.
Les fragments de tri SQL viennent de listes fermées ; les valeurs sont paramétrées.

## Transaction de réservation

1. Démarrer une transaction `SERIALIZABLE`.
2. Verrouiller le créneau avec `FOR UPDATE`.
3. Verrouiller l'adhérent et vérifier l'absence d'inscription active.
4. Vérifier fenêtre, abonnement et quota de la semaine locale du créneau.
5. Compter les confirmations et créer une confirmation ou une attente.
6. Valider la transaction, puis seulement produire la réponse HTTP.

Le verrou du créneau ordonne les décisions de capacité. Celui de l'adhérent
coordonne les décisions de quota entre créneaux différents. L'isolation
sérialisable détecte les lectures devenues incompatibles, notamment si le snapshot
a été pris avant l'attente d'un verrou. Une transaction annulée par PostgreSQL
est intégralement rejouée, avec un nouveau snapshot.

`40001` (sérialisation) et `40P01` (interblocage) sont repris au maximum cinq fois,
avec une courte attente variable. Si le conflit persiste, réponse 503 et
`Retry-After: 1`. Aucun effet externe ni réponse HTTP n'est émis dans le callback
rejouable. Les conflits métier, eux, renvoient 409 sans reprise automatique.

## Annulation et promotion

Le service verrouille le créneau, puis les adhérents concernés dans l'ordre de
leurs identifiants. Annulation et promotion restent dans la même transaction.
Il relit les règles d'éligibilité des personnes en attente dans l'ordre `cree_le,id`.
Une personne devenue inéligible passe à `retiree`, avec un motif ; la suivante
est examinée. Une seule confirmation remplace la place libérée.
Une annulation répétée ne déclenche pas une seconde promotion.

## Invariants de données

Une attente est un état de réservation, pas une inscription stockée dans une
seconde table indépendante. Un index unique partiel sur `(creneau_id,adherent_id)`
protège les états actifs `confirmee` et `en_attente` ensemble. Cela permet la
réinscription après annulation tout en conservant l'historique.

La vue SQL `listes_attente` expose les attentes actives et retirées. Le rang est
calculé sur les actives. Les compteurs de places sont calculés depuis les
confirmations : pas de compteur mutable à synchroniser.

PostgreSQL protège aussi clés étrangères, email unique, dates et capacités
positives et absence de chevauchement d'abonnements via une contrainte d'exclusion.
La capacité globale et le quota sont contrôlés par le service transactionnel ;
un accès SQL administratif direct doit respecter ces mêmes règles.

La capacité d'un créneau est copiée du cours lors de sa création. Les modifications
ultérieures du cours ne modifient pas cette occurrence. Ses dates sont également
explicites. Sa durée et sa date de début sont vérifiées contre le cours au moment
de la création ; aucune génération automatique de récurrence n'est exécutée.

## Concurrence sur les cours

La fiche porte un ETag fort dérivé de l'identifiant et de la version. Une modification
verrouille le cours, compare `If-Match` à la version courante, puis incrémente la
version dans la même transaction. Deux clients sur la même version ne peuvent
pas tous deux écraser la ressource avec ce même tag.

`If-Match` est facultatif : sans cet en-tête, la modification reste autorisée.
Le client qui veut éviter les écrasements doit donc l'envoyer.

## Pagination

Le planning utilise un offset, pratique pour une liste limitée et des pages
numérotées. Son tri inclut toujours `id` pour départager les dates identiques.
Une insertion avant la position peut toutefois déplacer les pages.

L'historique utilise `(cree_le,id)` décroissant. Le curseur contient exactement
ces valeurs, pas un numéro de page. Les microsecondes PostgreSQL sont conservées
en chaîne pour ne pas perdre de précision dans un objet `Date` JavaScript.
Une insertion plus récente n'est pas incluse dans le parcours déjà commencé.
Le curseur ne constitue pas un snapshot : une suppression ou une modification
concurrente peut toujours changer les résultats visibles.

## Vérification et limites du périmètre

Tests HTTP contre PostgreSQL isolé : CRUD, validation, erreurs, capacité, doublons,
quota concurrent, promotions, ETag, parcours par curseur et calendrier Paris.
Une horloge injectée fige les tests ; la démonstration utilise l'heure réelle et
crée des occurrences futures.

Les fonctionnalités d'authentification, OpenAPI, notifications, expiration des
attentes et génération automatique du planning restent hors périmètre.
Les timestamps d'une réservation ne sont pas modifiables par l'API.
