**(a) Ressources et collections** - au moins **4 ressources liées**. Pour chacune : nom de la
collection (pluriel), 3 à 5 attributs, et ses relations.

```markdown
## Ressources
- adherents         (id, nom, email) -> possède un ou plusieurs abonnements et effectue des réservations.
- abonnements       (id, adherent_id, formule, etat, date_debut, date_fin) -> appartient à un adherent (etat précise si l'abonnement est actif, expiré ou suspendu.)
- cours         (id, type) -> a un ou plusieurs créneaux.
- creneaux      (id, cours_id, etat, debut, fin, places_restantes) -> occurence d'un cours ; recoit des reservations et une liste_attente (etat précise si le cours est disponible ou complet, pour que, même s'il est complet, qu'il soit visible par l'utilisateur.)
- reservations      (id, adherent_id, creneau_id, statut) -> appartient à un adhérent pour un creneau spécifique.
- listes_attente        (id, creneau_id, adherent_id, rang) -> place d'un adherent dans la file d'un creneau.
```

**(b) Tableau URI x verbe x code de statut** pour les opérations principales (au moins 8 lignes) :

### 1. Cours ###

| Opération | Méthode + URI | Succès | Erreurs prévues |
|---|---|---|---|
| Lister le catalogue | `GET /cours` | `200` | - |
| Afficher un cours | `GET /cours/{id}` | `200` | `404` |
| Créer un cours | `POST /cours` | `201` + `Location` | `400`, `422` |
| Modifier un cours | `PATCH /cours/{id}` | `200` | `404` |
| Supprimer un cours | `DELETE /cours/{id}` | `204` | `404`, `409` |
| Ajouter un créneau de cours | `POST /cours/{id}/creneaux` | `201` + `Location` | `400`, `422` |

### 2. ###

### 3. ###

| ... | ... | ... | ... |

**(c) 2 à 3 choix de conception justifiés**, une phrase chacun. Exemples : « `emprunts` est une
collection de premier niveau et non une sous-ressource de `adherents`, car un emprunt se consulte
aussi côté exemplaire » ; « rendre un exemplaire = `PATCH /emprunts/{id}` qui renseigne `rendu_le`, plutôt qu'un
`POST /exemplaires/{id}/retour` (verbe dans l'URI) ou qu'un `DELETE` (l'historique des emprunts
disparaîtrait) ».

Rappels de conception (voir deck) : noms au pluriel, pas de verbe dans l'URI, filtres et
pagination en *query string*, sous-ressource quand la vie de l'une dépend de l'autre.

**Niveau visé** : votre design doit atteindre le **niveau 2** de l'échelle de Richardson
(ressources identifiées par URI **et** verbes et codes HTTP utilisés pour leur sens). Relisez votre
tableau (b) : un `POST` qui sert à lire, ou une erreur renvoyée en `200`, vous fait redescendre au
niveau 1. L'hypermédia (niveau 3) n'est pas demandé ici : vous n'en ajouterez qu'une touche en
séance 2, les liens de pagination.