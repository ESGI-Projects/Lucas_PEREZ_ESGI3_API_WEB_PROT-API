# TP 2 : CRUD et collection navigable

**Format** : projet individuel sur votre fil rouge.
**Durée** : 15 min de conception et remise du kit + 37 min de TP guidé.
**Prérequis** : TP1 terminé (`api-design.md`). Framework HTTP et client HTTP de votre choix
installés.
**Langage** : le vôtre. Le TP décrit des **gestes** et des **contrats HTTP**, pas des appels de
framework. Un store en mémoire est accepté (la persistance n'est ni un objectif ni évaluée).

---

## Objectifs

- Esquisser le modèle de données de votre sujet, puis démarrer sur le kit de données fourni.
- Implémenter le modèle de ressources de `api-design.md` : CRUD complet sur au moins 2 ressources.
- Rendre une collection navigable : pagination offset, filtrage, tri stable.
- Démarrer la collection de requêtes versionnée (`requests/`).

---

## Votre collection à rendre navigable

| Sujet | Collection navigable | Filtres attendus | Tri de départ |
|---|---|---|---|
| 1. Bibliothèque | `GET /ouvrages` (catalogue) | `auteur`, `disponible`, `annee_min` | `titre,id` |
| 2. Cinéma | `GET /seances` | `film`, `date`, `salle` | `debut,id` |
| 3. Salle de sport | `GET /creneaux` | `cours`, `coach`, `jour` | `debut,id` |

---

## Conception du schéma, puis kit de données (~10 min + 5 min)

Avant de coder, esquissez le modèle de données de **votre** sujet à partir de `api-design.md`.
Ajoutez à `docs/api-design.md` une section courte, sans SQL complet :

```markdown
## Modèle de données (esquisse)
- tables et colonnes clés
- relations et cardinalités (1-N, N-N)
- ce qui est stocké, ce qui est calculé
```

Le formateur passe sur chaque poste, puis vous remet le **kit de données** de votre sujet :
`schema.sql` et `seed.sql` (SQLite), `seed.json` (les mêmes données, pour un store en mémoire) et un
`README` de chargement. Le kit est un point de départ : si votre esquisse diffère sur un point que
vous savez justifier, adaptez le schéma.

Une ressource n'est pas une table : une table de liaison ne devient pas forcément une collection,
et une information calculée (une disponibilité, par exemple) n'a pas besoin de colonne.

---

## J1 : CRUD sur 2 ressources (~12 min)

Choisissez 2 ressources de votre sujet et implémentez les 5 opérations sur les données du kit.
Respectez les contrats :

```http
POST /ouvrages            -> 201 Created + Location: /ouvrages/128
GET  /ouvrages/128        -> 200 OK + la ressource
GET  /ouvrages            -> 200 OK + collection (paginée, voir J2)
PUT  /ouvrages/128        -> 200 OK (remplacement complet) ou 204
PATCH /ouvrages/128       -> 200 OK (champs fournis seulement)
DELETE /ouvrages/128      -> 204 No Content ; 404 si l'id n'existe pas
```

- `PUT` **remplace** : un corps partiel efface les champs absents. `PATCH` **modifie** les champs
  fournis.
- `DELETE` sur un id inconnu -> `404`, pas `204`.
- Pas encore de validation fine ni de format d'erreur normalisé : c'est la séance 3.

---

## J2 : rendre une collection navigable (~15 min)

Sur la collection du tableau ci-dessus.

**Pagination offset** :

```http
GET /ouvrages?page=3&limit=20
```

**Enveloppe de réponse** - choisissez une forme et tenez-la sur **toutes** vos collections :

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": [ { "id": 128, "titre": "Dune" } ],
  "pagination": { "page": 3, "limit": 20, "total": 402 },
  "links": { "next": "/ouvrages?page=4&limit=20", "prev": "/ouvrages?page=2&limit=20" }
}
```

**Filtrage** - chaque paramètre optionnel, combinable ; paramètre absent = pas de filtre :

```http
GET /ouvrages?auteur=herbert&disponible=true&annee_min=1960
```

**Tri stable** - toujours une clé de départage unique, sinon la pagination devient incohérente :

```http
GET /ouvrages?tri=titre,id&ordre=asc
```

Vérifiez à la main : deux éléments de même titre gardent le même ordre relatif d'un appel à
l'autre.

---

## J3 : collection de requêtes (~10 min)

Démarrez `requests/` avec le client HTTP de votre choix (suggestions : Bruno, Postman, Insomnia,
Hoppscotch, `curl`). La collection est exportée ou écrite en fichiers, puis versionnée. Une requête
nommée par opération (l'extension dépend de l'outil) :

```text
requests/
  ouvrages-create
  ouvrages-get
  ouvrages-list
  ouvrages-list-filtered
  ouvrages-update
  ouvrages-delete
```

Commitez. Notez en **une phrase** dans le `README` votre stratégie de pagination (« offset pour
l'instant ; la pagination par curseur sera ajoutée en séance 4 »).

---

## Livrable (commité en fin de séance)

- Section « Modèle de données (esquisse) » dans `docs/api-design.md` ; kit chargé (SQLite ou
  mémoire).
- API qui démarre et répond.
- CRUD complet sur au moins 2 ressources, codes de statut conformes aux contrats ci-dessus.
- Une collection paginée (offset) + filtrable + triable, avec enveloppe de réponse cohérente.
- Début de `requests/` versionné.
- Stratégie de pagination notée en une phrase dans le `README`.

## Critères de réussite

- [ ] `docs/api-design.md` contient l'esquisse du modèle de données.
- [ ] `POST` renvoie `201` **et** un `Location` exploitable.
- [ ] `DELETE` sur un id inconnu renvoie `404`.
- [ ] La collection navigable renvoie `data` + métadonnées de pagination + liens.
- [ ] Le tri comporte une clé de départage unique (tri stable vérifié à la main).
- [ ] `requests/` contient au moins une requête par opération, commitée.

## Travail personnel avant la séance 3

Lire la fiche RFC 9457 (`application/problem+json`) fournie en fin de séance
(`supports/tp/fiche-rfc9457-problem-json.md`) - 5 minutes, aucun code.
