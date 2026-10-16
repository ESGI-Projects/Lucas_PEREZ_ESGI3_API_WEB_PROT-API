# API Salle de sport

Projet individuel Web API — séances 1 à 4.

## Sujet fil rouge

Sujet n° 3 — Salle de sport.

## Stack

Langage : TypeScript (Node 24) / Framework HTTP : Express / Base : PostgreSQL 18 /
Client HTTP : Insomnia (collection importable) ou fichier `.http` /
Lancement : Docker Compose.

## Démarrer

Prérequis : Docker Engine et Docker Compose. Aucun Node ni PostgreSQL local requis.

```bash
docker compose up --build -d api
```

URL de base : http://localhost:3000, contrôle `/health`.
La variable `API_BIND_ADDRESS` choisit l'adresse de publication Docker
(`127.0.0.1` par défaut). Après un changement, relancer `docker compose up -d api`.
La base est initialisée, le kit est chargé et les migrations sont appliquées avant
le démarrage de l'API. Les données restent dans un volume nommé.

Les valeurs locales par défaut fonctionnent sans `.env`. Un fichier `.env` éventuel
est pris en compte ; `.env.example` décrit les paramètres. Pour un conflit de ports,
modifier `API_PORT` ou `DB_PORT`. Les identifiants proposés sont réservés au développement local.

```bash
docker compose ps
docker compose logs api migrate
docker compose down
```

Après modification du code, relancer la commande de démarrage avec `--build`.
Les migrations déjà appliquées sont vérifiées par checksum et ne sont pas rejouées.
Les anciens volumes de la séance 1 peuvent être repris s'ils contiennent le schéma
et le kit d'origine. Ne pas modifier une migration déjà appliquée : en ajouter une.

## Vérifier le projet

```bash
docker compose --profile test run --build --rm tests
```

Cette commande compile les types de l'application, des scripts et des tests,
puis lance de vraies requêtes HTTP contre une application et PostgreSQL.
La base `sport_test` est séparée de la base de démonstration et stockée en mémoire
par Docker. Les tests nettoient uniquement cette base et utilisent une horloge fixe.

## Démonstration reproductible

```bash
docker compose --profile tools run --build --rm demo
```

La commande crée un nouveau petit jeu de données avec un créneau demain à 18 h
à Paris, puis vérifie les scénarios : dernière place, doublon concurrent, attente,
annulation/promotion, validation, 304, 412 et différence offset/curseur.
Les échanges HTTP sont enregistrés avec leur date dans
[`docs/captures/demo.json`](docs/captures/demo.json), pour préparer la présentation
et disposer d'un support de secours.

Chaque exécution crée de nouveaux adhérents et créneaux de démonstration ; elle
ne supprime pas les données existantes. Les identifiants affichés permettent
également d'utiliser [`requests/parcours.http`](requests/parcours.http).

## Organisation

```text
src/
  app.ts                 composition de l'application, sans démarrage du serveur
  server.ts              démarrage et arrêt propre
  config/                validation de l'environnement
  database/              pool PostgreSQL et transactions
  http/                  validation, erreurs, pagination, ETag
  modules/
    adherents/           CRUD et consultation des abonnements
    cours/               CRUD conditionnel et consultation des coachs
    planning/            création et consultation des créneaux
    reservations/        inscription, quota, attente, annulation et historique
db/
  migrations/            migrations immuables, dont le chargement initial du kit
  seeds/                 génération des données de démonstration datées
scripts/                 commandes de migration et démonstration
tests/                   tests d'intégration HTTP
requests/                parcours HTTP versionné et collection importable
docs/                    conception, architecture et préparation de soutenance
```

Chaque module sépare routes, schémas, services et repositories. Le service porte
les règles et transactions ; le repository contient le SQL paramétré.
Voir [`docs/architecture.md`](docs/architecture.md).

## Contrat et choix

- CRUD complets : `/adherents` et `/cours`, dont PUT et PATCH distincts.
- Planning : `/creneaux`, filtres combinables `cours`, `coach`, `jour`, `from`, `to`.
- Pagination offset des collections ; historique `/reservations` par curseur
  `cree_le,id` décroissant. Le paramètre `page` permet la comparaison en offset.
- Toutes les erreurs en `application/problem+json`, validation sur les écritures.
- ETag sur les cours : `If-None-Match` en lecture, `If-Match` en écriture.
- Réservations protégées par transactions sérialisables, verrous et unicité SQL.
- Fenêtre de sept jours calendaires ; quota sur la semaine du cours en Europe/Paris.

Contrat détaillé : [`docs/api-design.md`](docs/api-design.md).
L'API est ouverte, conformément au périmètre S1–S4 : authentification et OpenAPI
ne font pas partie de cette réalisation.

## Développer avec Node (facultatif)

Node 24 et npm sont nécessaires pour cette variante. Démarrer PostgreSQL avec
`docker compose up -d db`, installer avec `npm ci`, puis exporter `DATABASE_URL`
correspondant à la base locale avant les commandes suivantes :

```bash
npm run db:migrate
npm run dev
npm run check
npm run format:check
```

`npm run build` produit `dist/` ; `npm start` lance cette version compilée.
`npm test` exige `NODE_ENV=test` et une URL de base dont le nom finit par `_test`.
La commande Docker dédiée reste le chemin recommandé pour les tests.

## Réinitialiser volontairement

```bash
docker compose --profile test down -v
```

**Cette commande supprime le volume de la base et toutes ses données.** Le prochain
démarrage recréera le schéma et chargera le kit. Aucun reset n'est nécessaire pour
mettre le code à jour ou ajouter une migration.
