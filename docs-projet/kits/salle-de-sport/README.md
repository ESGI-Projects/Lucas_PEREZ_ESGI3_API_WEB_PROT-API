# Kit de données - Sujet 3 : salle de sport

Données **fictives** pour démarrer votre API sans écrire de jeu d'essai. C'est un point de départ :
adaptez le schéma si vos choix de `docs/api-design.md` diffèrent. La persistance n'est pas évaluée :
SQLite, une autre base ou un store en mémoire, au choix.

## Contenu

| Fichier | Rôle |
|---|---|
| `schema.sql` | tables et clés (SQLite) |
| `seed.sql` | données, dans l'ordre des clés étrangères |
| `seed.json` | les mêmes données en JSON, pour un store en mémoire |

## Charger dans SQLite

```bash
sqlite3 app.db < schema.sql
sqlite3 app.db < seed.sql
```

SQLite n'active pas les clés étrangères par défaut : exécutez `PRAGMA foreign_keys = ON;` à chaque
connexion ouverte par votre API.

Les types `DATE`, `TIME`, `TIMESTAMP` et `VARCHAR(n)` décrivent le contrat de chaque colonne, mais
SQLite ne les fait pas respecter : il ne vérifie ni la longueur d'un `VARCHAR`, ni le format d'une
date. Les valeurs sont stockées en texte ISO 8601. Ce schéma se transpose tel quel vers une autre
base (PostgreSQL, MySQL).

## Charger en mémoire

`seed.json` contient `meta` et `tables` : pour chaque table, un tableau d'objets dont les clés sont
les noms de colonnes de `schema.sql`. Les relations passent par les identifiants, comme en base.

## Conventions

- Identifiants entiers, attribués à partir de 1.
- `DATE` au format `YYYY-MM-DD` ; `TIMESTAMP` en ISO 8601 UTC (`2026-10-05T07:00:00Z`) ;
  `TIME` au format `HH:MM`.
- Semaine de référence (le « maintenant » des données) : lundi 2026-10-05.
- Chaque cours porte sa règle de récurrence (`jour_semaine`, `heure_debut` en heure locale, `duree_min`, `periode_debut`, `periode_fin`, `fuseau`).
- `creneaux` contient les occurrences des 2 semaines à partir de la semaine de référence.

## Volumes

| Table | Lignes |
|---|---|
| `adherents` | 80 |
| `abonnements` | 80 |
| `coachs` | 8 |
| `cours` | 30 |
| `creneaux` | 60 |
| `reservations` | 451 |
| `listes_attente` | 30 |
