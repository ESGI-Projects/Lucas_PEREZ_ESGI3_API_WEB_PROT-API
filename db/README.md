# Organisation SQL

`migrations/` est exécuté par `npm run db:migrate` sous verrou consultatif et avec
un historique de checksums. Chaque migration est une transaction.

- 001 : schéma PostgreSQL initial.
- 002 : jeu de données initial du kit (historique conservé).
- 003 : invariants, capacités propres aux occurrences et stockage unifié des inscriptions.

`seeds/demo.ts` crée des données futures indépendantes du calendrier du kit.
Les tests créent leurs propres fixtures et ne dépendent pas du contenu du kit.
Ne pas modifier une migration appliquée : ajouter le prochain numéro.
