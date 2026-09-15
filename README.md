# prot-api

## Sujet fil rouge
Sujet n° 3 - Salle de Sport

## Stack
Langage : TypeScript   /   Framework HTTP : Express   /   Client HTTP : Insomnia
Base de données : PostgreSQL   /   Conteneurisation : Docker + Docker Compose

## Lancer le projet

### Prérequis
- Docker Engine et Docker Compose (aucune autre installation : ni Node, ni PostgreSQL en local)

### Lancer

```bash
docker compose up
```

Au premier démarrage, PostgreSQL crée la base puis exécute automatiquement les scripts
d'initialisation (`db/01-schema.sql` puis `db/02-seed.sql`), montés dans le conteneur.
La base est alors prête, avec le schéma et les données du kit.

> À ce stade (séance 1), seule la base de données est conteneurisée. Le service API
> (Express/TypeScript) sera ajouté en séance 2 ; `docker compose up` le lancera alors
> en même temps que la base.

### Réinitialiser la base

Les scripts d'initialisation ne s'exécutent qu'au **premier** démarrage, sur un volume
vierge. Pour repartir de zéro (après modification du schéma, par exemple) :

```bash
docker compose down -v   # -v supprime le volume de données
docker compose up
```