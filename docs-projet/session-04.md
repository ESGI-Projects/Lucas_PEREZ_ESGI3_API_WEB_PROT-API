# TP 4 : le piège de concurrence de votre sujet + cache conditionnel

**Format** : projet individuel sur votre fil rouge.
**Durée** : 42 min de TP guidé.
**Prérequis** : TP3 terminé (`problem+json` + validation + tests). Piège du sujet relu.
**Langage** : le vôtre. Le TP décrit le geste (« renvoyer un `409` avec un corps `problem+json`
quand l'exemplaire est déjà emprunté ») et le contrat, pas l'appel d'un framework.

---

## Objectifs

- Implémenter et **démontrer** le piège de concurrence de votre sujet par un scénario reproductible
  (deux requêtes concurrentes).
- Paginer par curseur une collection de votre API (tous les sujets).
- Ajouter `ETag` + requête conditionnelle sur au moins une ressource.
- Rédiger votre stratégie face au piège dans `docs/api-design.md`.

---

## Votre piège, décliné

| Sujet | Le piège | Geste attendu |
|---|---|---|
| 1. Bibliothèque | double emprunt concurrent d'un exemplaire ; catalogue mouvant paginé | règle « un exemplaire emprunté une seule fois à la fois » -> `409` ; **pagination par curseur** + tri stable sur le catalogue |
| 2. Cinéma | deux clients visent le même siège | `hold` temporaire avec expiration + confirmation **idempotente** (`Idempotency-Key`) + `409` si le siège est pris |
| 3. Salle de sport | réservations au-delà de la capacité / du quota | fenêtre d'ouverture + **quota par adhérent et période** + capacité -> bascule en `listes_attente` ; le même adhérent qui réserve deux fois le même créneau en parallèle -> `409` ; deux adhérents sur la dernière place -> une réservation confirmée, l'autre en liste d'attente |

---

## J1 : traiter le piège (~15 min)

**Tous les sujets** : la règle métier qui détecte l'état incohérent et refuse proprement.

```http
POST /exemplaires/57/emprunts        (exemplaire déjà emprunté)
HTTP/1.1 409 Conflict
Content-Type: application/problem+json

{ "type": ".../exemplaire-indisponible", "title": "Exemplaire déjà emprunté",
  "status": 409, "detail": "L'exemplaire 57 est emprunté jusqu'au 2026-10-20." }
```

`409` n'est pas `422` : la requête serait valide à un autre moment, mais l'état courant l'interdit.

**Sujet 2 en plus** - clé d'idempotence sur la confirmation, fournie par le client, répétée sur
les retries :

```http
POST /reservations/42/confirmation
Idempotency-Key: 7b2c1a90-4e...
```

Premier appel : traite et stocke le résultat sous la clé. Rejeu même clé : renvoie le résultat
stocké, sans re-confirmer.

---

## J2 : scénario reproductible (~10 min)

Un script (ou deux requêtes lancées en parallèle depuis `requests/`) qui frappe **en même temps**
la ressource sensible :

```http
# en parallèle, deux clients sur la même cible
POST /exemplaires/57/emprunts   { "adherent_id": 1 }   -> 201 Created
POST /exemplaires/57/emprunts   { "adherent_id": 2 }   -> 409 Conflict
```

Attendu, à **capturer** (sortie ou test) : exactement **un** gagnant, **un** `409` propre, aucun
état incohérent (pas deux emprunts actifs sur le même exemplaire ; pas deux réservations sur le
même siège ; pas de dépassement de capacité). Sujet 3 : ce scénario porte sur le même adhérent
envoyé deux fois ; jouez aussi deux adhérents sur la dernière place d'un créneau -> une
réservation confirmée, l'autre en liste d'attente. Ajoutez ces scénarios à la suite de tests.

---

## J3 : curseur, cache conditionnel, stratégie face au piège (~17 min)

**Pagination par curseur (tous les sujets, ~5 min)** - sur la collection de votre sujet :

| Sujet | Collection | Tri stable |
|---|---|---|
| 1. Bibliothèque | `GET /ouvrages` (catalogue, piège du sujet) | `titre,id` croissant |
| 2. Cinéma | `GET /reservations` (historique) | `cree_le,id` décroissant (plus récentes d'abord) |
| 3. Salle de sport | `GET /reservations` (historique) | `cree_le,id` décroissant (plus récentes d'abord) |

```http
GET /ouvrages?tri=titre,id&limit=20
-> { "data": [...], "links": { "next": "/ouvrages?tri=titre,id&limit=20&after=RHVuZXwxMjg" } }
```

`after` encode la **position** du dernier élément renvoyé (ses valeurs de tri), pas un numéro de
page : la page suivante reprend « juste après » cet élément. Test à capturer : lire la page 1,
insérer un élément qui se place avant la position courante, lire la page suivante par
`links.next` -> ni doublon ni élément sauté. Refaites le même parcours en offset pour constater la
différence. Vos autres collections restent en offset.

**Cache conditionnel (~6 min)** - `ETag` sur au moins une ressource (fiche ouvrage / plan de salle d'une séance / planning de la
semaine) :

```http
GET /ouvrages/128            -> 200 OK   ETag: "v7"
GET /ouvrages/128   If-None-Match: "v7"  -> 304 Not Modified   (corps vide)
PUT /ouvrages/128   If-Match: "v7"       -> 200 (ETag devient "v8")  |  412 si déjà en "v8"
```

Capturez un `304` et un `412` dans `requests/`.

**Stratégie face au piège (~6 min)** - ajoutez cette section à `docs/api-design.md` (relue au checkpoint
de la séance 5) :

```markdown
## Stratégie face au piège de concurrence

### Le piège
<le piège de votre sujet, en 3 lignes>

### Ce que fait l'API
<409 + quelle détection ; idempotence si sujet 2 ; curseur si sujet 1 ; ETag/If-Match>

### Pourquoi REST ici
<2 à 3 phrases : ressources stables, cache HTTP, outillage>

### Conséquences
<ce que ça impose au client ; ce qu'on ne gère pas>
```

---

## Livrable (commité en fin de séance)

- Le piège du sujet traité et **démontré** par un scénario reproductible (2 requêtes concurrentes),
  comportement attendu capturé et testé.
- Une collection paginée par curseur (tri stable) ; parcours avec insertion capturé.
- `ETag` + requête conditionnelle (`If-None-Match` en lecture, `If-Match` en écriture) sur au moins
  une ressource ; `304` et `412` capturés.
- Section **« Stratégie face au piège »** dans `docs/api-design.md`.

## Critères de réussite

- [ ] Le scénario concurrent produit **un** succès et **un** `409`, jamais deux succès (sujet 3 :
      le même adhérent envoyé deux fois).
- [ ] Sujet 3 : sur la dernière place, une réservation confirmée et une en liste d'attente, jamais
      deux confirmées au-delà de la capacité.
- [ ] Le `409` sort en `application/problem+json`.
- [ ] Sujet 2 : le rejeu avec la même `Idempotency-Key` ne crée pas de seconde confirmation.
- [ ] Tous les sujets : la pagination par curseur ne produit ni doublon ni saut quand un élément est
      inséré pendant le parcours.
- [ ] `If-None-Match` renvoie `304`, `If-Match` obsolète renvoie `412`.
- [ ] `docs/api-design.md` contient la stratégie face au piège et « Pourquoi REST ici ».

## Travail personnel avant la séance 5

Repérer les 4 à 5 routes principales de votre API à spécifier en premier en OpenAPI. Aucun code.
