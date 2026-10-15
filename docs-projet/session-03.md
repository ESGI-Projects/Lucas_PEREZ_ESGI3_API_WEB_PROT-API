# TP 3 : erreurs normalisées, validation, tests

**Format** : projet individuel sur votre fil rouge.
**Durée** : 42 min de TP guidé.
**Prérequis** : TP2 terminé (CRUD + collection navigable + `requests/`). Fiche RFC 9457 lue.
**Langage** : le vôtre. Snippets en HTTP brut et pseudo-code ; transposez dans votre framework.

---

## Objectifs

- Un format d'erreur **unique** sur toute l'API, produit par un handler central.
- Une validation d'entrée sur **toutes** les routes d'écriture, avec détail par champ.
- Une suite de tests d'intégration HTTP qui tourne.

---

## Cas d'erreur naturels de votre sujet

À couvrir en priorité dans les tests de J3 :

| Sujet | Requête mal formée (`400`) | Corps lisible mais invalide (`422`) | Ressource absente (`404`) |
|---|---|---|---|
| 1. Bibliothèque | JSON illisible | ISBN au mauvais format, `au` avant `du`, adhérent inexistant | `GET /ouvrages/999` |
| 2. Cinéma | JSON illisible, `Content-Type` absent | siège non listé dans le plan de salle, réservation sur une séance déjà passée | `GET /seances/999` |
| 3. Salle de sport | paramètres `from` / `to` non parsables | créneau hors fenêtre d'ouverture, quota dépassé | `GET /creneaux/999` |

---

## J1 : handler d'erreur central (~15 min)

Les routes **lèvent** des erreurs typées ; elles ne construisent jamais la réponse d'erreur.

```text
NotFoundError(resource, id)        -> 404
ValidationError(errors[])          -> 422  (ou 400 si le corps est illisible)
ConflictError(detail)              -> 409  (utilisé en séance 4)
```

Un seul point de sortie met l'erreur au format `application/problem+json` :

```http
HTTP/1.1 404 Not Found
Content-Type: application/problem+json

{
  "type": "https://votre-api/errors/not-found",
  "title": "Ressource introuvable",
  "status": 404,
  "detail": "L'ouvrage 999 n'existe pas.",
  "instance": "/ouvrages/999"
}
```

Branchez toutes les routes existantes (TP2) sur ce handler. Aucune erreur ne doit plus sortir en
texte brut ni exposer de *stack trace*.

---

## J2 : validation d'entrée sur toutes les écritures (~15 min)

Chaque `POST`, `PUT`, `PATCH` est validé **avant** la logique métier, par un schéma déclaratif à
côté de la route (JSON Schema ou l'équivalent de votre framework) :

- présence des champs requis, types attendus, valeurs de bord (quantité strictement positive, énumération, format
  d'email/ISBN) ;
- champs inconnus : rejetés **ou** ignorés, choix documenté.

`400` (corps illisible) vs `422` (corps lisible, sémantiquement invalide). En cas d'échec sur
plusieurs champs, renvoyez-les **tous** :

```http
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json

{ "type": ".../validation", "title": "Requête invalide", "status": 422,
  "errors": [
    { "field": "email", "message": "format invalide" },
    { "field": "quantite", "message": "doit être supérieur à 0" }
  ] }
```

Capturez une de ces réponses multi-champs dans `requests/`.

---

## J3 : suite de tests d'intégration (~12 min)

L'API est démarrée, les tests envoient de **vraies** requêtes HTTP (client de test HTTP de votre
langage, ou runner de votre collection). Pour les routes clés :

```text
cas nominaux    : POST valide -> 201 ; GET liste -> 200 + enveloppe ; GET /x/{id} -> 200
cas d'erreur    : corps invalide -> 422 + problem+json ; /x/999 -> 404 ; (409 : séance 4)
```

Au moins **5 tests** : 2 nominaux + 3 cas d'erreur (dont ceux du tableau de votre sujet). La suite
doit tourner d'une commande et passer au vert. Enrichissez `requests/` des mêmes scénarios.

---

## Contrats de référence (agnostiques)

```json
{
  "type": "https://votre-api/errors/<categorie>",
  "title": "<résumé stable>",
  "status": 422,
  "detail": "<ce cas précis>",
  "instance": "<chemin de la requête>",
  "errors": [ { "field": "...", "message": "..." } ]
}
```

- `type` = catégorie (URL stable), `title` = résumé, `detail` = ce cas, `errors` = extension pour
  la validation.
- `Content-Type: application/problem+json` sur **toutes** les réponses d'erreur.

---

## Livrable (commité en fin de séance)

- Format `problem+json` unique, produit par un handler central, sur toute l'API.
- Validation d'entrée sur toutes les routes d'écriture ; une erreur multi-champs capturée.
- Suite de tests d'intégration qui tourne : cas nominaux CRUD / pagination + 2 à 3 cas d'erreur.
- `requests/` enrichie des cas d'erreur.

## Critères de réussite

- [ ] Aucune réponse d'erreur en texte brut ou avec *stack trace*.
- [ ] Toutes les réponses d'erreur ont `Content-Type: application/problem+json` et les champs
      `type`, `title`, `status`.
- [ ] Une erreur de validation renvoie **tous** les champs fautifs d'un coup.
- [ ] `400` vs `422` correctement distingués sur au moins un exemple.
- [ ] La suite de tests tourne d'une commande et passe au vert.

## Travail personnel avant la séance 4

Relire le « piège caractéristique » de votre sujet dans `sujets-projet.md`. Aucun code.
