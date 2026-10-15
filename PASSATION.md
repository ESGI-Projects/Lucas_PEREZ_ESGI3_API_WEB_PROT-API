# Mémoire de travail — Codex / Claude Code

Dernière mise à jour : 2026-10-15, implémentation S1–S4 et première validation complète.

Ce fichier sert à reprendre le travail entre assistants et sessions. Ce n'est pas
un livrable pédagogique. Il décrit l'état réel, pas un résultat supposé.
Lire ce fichier puis `docs/cadrage.md` avant de commencer.

## Objectif et manière de travailler

Projet individuel d'API de salle de sport, avec soutenance. L'utilisateur veut
finaliser les séances 1 à 4, puis les documentations, puis préparer sérieusement
l'oral. Il doit comprendre et savoir défendre le code et les choix.

Le cadrage est validé. La suite logique est la conception technique détaillée et
l'implémentation ; ne pas redemander les choix déjà validés.
Expliquer en français les décisions significatives. L'utilisateur attend une
architecture très propre, pertinente et évolutive, du clean code et une exécution
fiable. Éviter les abstractions gratuites et les fonctionnalités hors barème.
Ne pas confondre originalité du découpage et qualité de conception.

## Sources de vérité

- `docs/cadrage.md` : périmètre et décisions validés ensemble.
- `docs-projet/session-01.md` à `session-04.md` : consignes des TP.
- `docs-projet/Grille de soutenance - Projet Web API.pdf` : barème effectif.
- `docs-projet/kits/salle-de-sport/` : kit d'origine, SQLite / JSON.
- `db/01-schema.sql` et `db/02-seed.sql` : adaptation PostgreSQL existante.
- `docs/api-design.md` : brouillon utilisateur à compléter, pas encore le contrat final.

En cas de divergence, relire les sources et expliciter le choix. Ne pas supposer
que le code existant satisfait déjà les consignes.

## Barème et soutenance

- Projet : 12 points ; questions : 8 points.
- S1–S3 : lancement 2, conception 3, robustesse 3.
- S4 : 2 points ; S5 OpenAPI : 1 ; S6 sécurité : 1.
- Arrêt à S4 décidé par l'utilisateur : maximum théorique 18/20, questions incluses.
- Pas de bonus à rechercher avec des fonctionnalités supplémentaires.
- Présentation de 10 minutes : architecture 2, démo nominale 3, échecs 3,
  choix justifiés 2 ; puis 10 minutes de questions.
- Quatre questions à 2 points, deux fondamentaux et deux cas limites.
- Les questions de diagnostic peuvent porter sur des notions non implémentées :
  préparer aussi le raisonnement sur ces notions, sans ajouter les TP S5/S6.
- S4, scénario minimal de la grille pour ce sujet : deux demandes concurrentes
  sur la dernière place donnent une confirmation et une attente.
- Palier S4 complet : scénario démontré plus ETag conditionnel OU curseur.
  Choix validé : réaliser les deux, conformément au TP4 complet.
- Prévoir aussi les captures de secours et la sortie des tests prévues par la grille.

## Architecture validée

Monolithe modulaire TypeScript / Express / PostgreSQL, Docker Compose.

```text
src/
  app.ts
  server.ts
  config/env.ts
  database/pool.ts
  database/transaction.ts
  http/errors.ts
  http/error-handler.ts
  http/pagination.ts
  http/etag.ts
  modules/
    adherents/
    cours/
    planning/
    reservations/
tests/
  integration/
  helpers/
db/
  migrations/
  seeds/
requests/
docs/
```

Dans chaque module : routes, schémas, service, repository. Pour les réservations,
un fichier de règles pures `reservation-policy.ts` si les règles le justifient.
Flux : route → service → repository → PostgreSQL.

- Routes : validation et adaptation HTTP, pas de contrôleur supplémentaire obligatoire.
- Services : métier et transactions, sans objets Express.
- Repositories : SQL paramétré, sans statuts HTTP.
- Une transaction partage la même connexion entre tous ses accès SQL.
- Composition explicite, fonctions/types ciblés ; ni repository universel,
  ni classes de base systématiques, ni framework d'injection de dépendances.
- Contraintes SQL pour protéger les invariants, migrations et seeds séparés.

## Décisions fonctionnelles validées

Le détail est dans `docs/cadrage.md`. Rappel :

- CRUD complets adhérents et cours, PUT distinct de PATCH.
- Créneaux : liste, fiche, création sous un cours ; filtres cours/coach/jour,
  tri stable `debut,id`, pagination offset.
- Réservations : création, consultation, annulation, historique par curseur
  `cree_le,id` décroissant.
- Abonnements et coachs : consultation, données préparées.
- Attente : consultation, inscriptions pilotées par les réservations.
- Pas de génération automatique des récurrences.
- Fenêtre de réservation : sept jours avant le début jusqu'au début exclu.
- Abonnement couvrant la date locale du cours, pas de chevauchement d'abonnements.
- Quota sur la semaine DU CRÉNEAU, lundi–dimanche en Europe/Paris.
- Confirmations seules consomment le quota ; attente soumise à l'éligibilité.
- Une inscription active par adhérent/créneau, confirmation et attente comprises.
- Créneau plein : attente plutôt que refus pour capacité.
- Annulation avant début, historique conservé ; répétition retourne l'état annulé.
- Promotion automatique du premier en attente encore éligible ; sortie des
  inéligibles avec motif conservé ; ordre `cree_le,id`, rang calculé.
- Annulation et promotion atomiques.
- POST sous `/creneaux/{id}/reservations` : 201 + Location de la réservation
  ou de l'attente ; réponse explicite sur le résultat.
- JSON illisible : 400 ; validation du corps : 422 ; ressource absente : 404 ;
  doublon/fenêtre/abonnement/quota : 409.
- Attention : S3 cite quota dépassé comme 422 ; choix validé 409, à justifier
  comme conflit avec l'état courant dans la documentation et à l'oral.
- ETag sur cours, If-None-Match → 304 ; If-Match fourni et obsolète → 412,
  contrôle atomique de la précondition et de l'écriture.
- Champs inconnus rejetés ; handler central application/problem+json.
- Suppression empêchée avec 409 si incompatible avec relations ou historique.

## État réel vérifié

- API S1–S4 implémentée, TypeScript strict, modules convenus, Express 5.
- `package-lock.json` versionné dans les fichiers à remettre, versions npm exactes.
- PostgreSQL 18 ; migrations 001/002/003 sous verrou et avec checksum.
- Kit initial préservé ; anciennes sources SQL conservées et expliquées dans db/README.md.
- CRUD adhérents et cours, validation des écritures, erreurs problem+json centralisées.
- Planning filtré/trié/paginé et relation GET/POST cours → créneaux.
- Réservations, attente, quota, annulation et promotion atomiques.
- Curseur historique conservant les microsecondes, mode offset explicite pour comparaison.
- ETag des cours et contrôles atomiques If-Match ; If-None-Match pour 304.
- Consultation des coachs et abonnements.
- Docker Compose lance la base, les migrations, puis l'API ; image runtime sans
  dépendances de développement et processus Node non root.
- API du LAB publiée sur http://192.168.50.117:3000 ; configuration VPN décrite ci-dessous.
- Base de test séparée, en tmpfs ; tests HTTP avec horloge fixe et nettoyage protégé.
- Démonstration contre le vrai service exécutée avec succès ; captures réelles
  horodatées dans docs/captures/demo.json.
- Démarrage sans .env et sur une base vierge vérifié avec un projet Compose isolé :
  health 200 et kit de 80 adhérents chargé ; environnement isolé ensuite supprimé.
- README, api-design, architecture, guide de soutenance et requêtes rédigés.
- Brouillon api-design utilisateur conservé intégralement dans docs/archives/api-design-initial.md.
- Collection Postman v2.1 fournie, format importable par Insomnia selon sa documentation.
  Import dans l'interface graphique NON testé, environnement sans interface.
- Préparation orale écrite fournie ; entraînement oral AVEC l'utilisateur NON commencé.
- Aucun commit créé par l'assistant.

## Commandes de référence et vérifications

```bash
# Lancement
docker compose up --build -d api
# Tests isolés et vérification des types
docker compose --profile test run --build --rm tests
# Démonstration HTTP avec de nouvelles données futures et captures
docker compose --profile tools run --build --rm demo
```

`npm run format:check` vérifie le format. Node n'est pas installé sur l'hôte de la
session ; les commandes npm ont été exécutées via l'image Docker Node 24 et un
montage du dépôt. Aucun outil Node local n'est nécessaire au lancement documenté.

Derniers résultats : **24 tests réussis, 0 échec**, compilation des types réussie,
format vérifié, `git diff --check` sans erreur. Sortie horodatée conservée dans
`docs/captures/tests.txt`. Démarrage vierge sans .env et démonstration complète
également réussis. La prochaine action est la lecture guidée avec l'utilisateur.

## Précisions techniques désormais arrêtées

- Une attente est un état `en_attente` dans reservations ; listes_attente est une
  vue SQL, avec rang calculé et états retirés conservés avec motif. Index unique
  partiel commun aux confirmations et attentes actives.
- Le kit a quota_hebdo=7 pour illimite ; la formule prime, aucun quota appliqué.
- Chaque occurrence copie la capacité du cours ; modifier le cours n'altère pas
  les occurrences existantes. Les occurrences sont explicites, avec contrôle de
  période/durée, sans imposer le jour/heure récurrent du cours.
- Fenêtre de sept jours calendaires en Europe/Paris, testée autour du changement d'heure.
- Transactions SERIALIZABLE, créneau verrouillé puis adhérents par id croissant ;
  reprises intégrales sur 40001/40P01, cinq tentatives puis 503 + Retry-After.
- Capacité et quota globaux reposent sur le service transactionnel ; les accès SQL
  administratifs directs doivent respecter ces règles. Les autres contraintes
  (unicité active, relations, dates, périodes d'abonnement) sont aussi en SQL.
- Le curseur n'est pas un snapshot et n'inclut pas les nouvelles entrées plus récentes.
- Un POST rejoué après perte de réponse peut donner 409 ; pas de clé d'idempotence.
- La démonstration est additive : elle crée un petit jeu neuf à chaque exécution,
  sans supprimer les données de l'utilisateur.

## Prochaines étapes de collaboration

1. Faire une lecture guidée avec l'utilisateur : suivre une requête depuis la route
   jusqu'à PostgreSQL, puis expliquer les transactions et les invariants.
2. Importer la collection dans son Insomnia et ajuster les variables à partir de la
   démo ; tester son parcours de présentation sur son poste réel.
3. Répéter le lancement et la démo de dix minutes, puis entraîner aux questions :
   fondamentaux, cas limites, relances, montrer le code et justifier les choix.
4. Corriger les points éventuellement relevés par la revue de l'utilisateur.
5. Vérifier l'état Git avant tout commit : les fichiers fournis dans docs-projet/
   et le brouillon initial étaient déjà non suivis/modifiés avant l'implémentation.

## Limites et vigilance

- L'utilisateur n'a pas encore été formé au code : ne pas annoncer qu'il est prêt
  pour l'oral au seul motif que les tests passent.
- Pas de S5/S6 implémenté : rester dans le périmètre validé.
- Le guide de questions est un entraînement créé pour le projet, pas la banque officielle.
- Pas de reset de la base utilisateur pour refaire une démo ; utiliser la commande dédiée.
- Ne pas modifier les migrations déjà appliquées ; ajouter une nouvelle migration.
- La compatibilité avec un ancien volume de séance 1 est prévue ; un volume
  personnalisé ou un schéma partiellement modifié ne doit pas être assimilé au kit.

## Entretien de cette mémoire

Après chaque étape significative et avant une passation : mettre à jour la date,
l'état réel, les choix nouveaux, les commandes de vérification et leurs résultats,
ainsi que la prochaine action exacte. Distinguer fait, prévu et non vérifié.
Ne jamais inscrire de secrets, tokens ou contenu de `.env` ici.
Les nouvelles instructions utilisateur priment sur cette mémoire.

Pour reprendre avec un autre assistant :

> Lis PASSATION.md et docs/cadrage.md, vérifie l'état du dépôt, puis poursuis
> les prochaines étapes validées. Mets la mémoire à jour au fil du travail.

## Accès réseau du LAB — mise à jour 2026-10-15

L'utilisateur travaille depuis son PC, via VPN puis SSH, sur une VM Proxmox.
Interface ens18 : `192.168.50.117/24` (adresse DHCP), passerelle `192.168.50.1`.
Le bind localhost empêchait l'accès direct depuis Insomnia sur son PC.
Compose utilise maintenant `${API_BIND_ADDRESS:-127.0.0.1}` pour le port API.
Le `.env` local (ignoré par Git) fixe cette variable à `192.168.50.117`.
La collection JSON et le parcours HTTP utilisent cette IP comme base_url.
Les collections déjà importées doivent être ajustées dans Insomnia.
La publication PostgreSQL reste sur localhost.
Si l'IP de la VM change, adapter le bind et les variables du client ; prévoir
une réservation DHCP côté LAB. Le contrôle depuis la VM ne prouve pas le trajet
VPN depuis le PC : ce dernier doit encore ouvrir `/health` sur cette adresse.

Vérification effectuée depuis la VM : `GET http://192.168.50.117:3000/health`
renvoie HTTP 200 et `{"status":"ok"}` ; socket confirmé sur cette IP, port 3000.
