# Cadrage validé

Référence des décisions prises ensemble le 15 octobre 2026. Le brouillon
`api-design.md` sera complété pour décrire le contrat effectivement implémenté.

## Objectif

Finaliser les séances 1 à 4 du sujet Salle de sport, puis les documentations
et la préparation de la soutenance. Pas de fonctionnalité des séances 5 et 6
prévue. La compréhension des notions nécessaires aux questions reste au programme.

## Architecture

Monolithe modulaire TypeScript / Express / PostgreSQL, lancé avec Docker Compose.
Modules : adhérents, cours, planning, réservations.

- Routes : adaptation HTTP et validation par schémas déclaratifs.
- Services : cas d'usage, règles métier et coordination des transactions.
- Repositories : SQL paramétré, exécuté sur la connexion fournie.
- Erreurs applicatives traduites par un handler HTTP central.
- Composition explicite dans `app.ts`, démarrage et arrêt dans `server.ts`.
- Utilitaires HTTP ciblés pour pagination, ETag et erreurs.
- Migrations versionnées et données de démonstration séparées.
- Pas de repository générique ni de framework d'injection de dépendances.

## Périmètre fonctionnel

| Ressource        | Opérations                                                              |
| ---------------- | ----------------------------------------------------------------------- |
| Adhérents        | CRUD complet, PUT et PATCH distincts                                    |
| Cours            | CRUD complet, PUT et PATCH distincts                                    |
| Créneaux         | Liste, fiche, création sous un cours                                    |
| Réservations     | Création, consultation, historique et annulation                        |
| Listes d'attente | Consultation ; entrées et sorties gérées par le parcours de réservation |
| Abonnements      | Consultation, données préparées                                         |
| Coachs           | Consultation, données préparées                                         |

Les occurrences de cours sont créées explicitement ou préparées dans les données.
La génération automatique des récurrences est hors périmètre.
Une suppression incompatible avec l'historique ou les relations renvoie 409.

## Règles de réservation

- Fenêtre : `[début du créneau - 7 jours, début du créneau[`.
- Abonnement valable à la date locale du créneau ; périodes sans chevauchement
  pour un même adhérent.
- Quota sur la semaine du créneau, du lundi au dimanche en `Europe/Paris`.
- Seules les réservations confirmées consomment le quota.
- Une inscription active au maximum par adhérent et créneau, attente comprise.
- Place disponible : réservation confirmée ; sinon : inscription en attente.
- Même conditions d'éligibilité pour entrer en attente que pour réserver.
- Les dates d'instants sont stockées en UTC ; le calendrier métier utilise Paris.

### Contrat de création

`POST /creneaux/{id}/reservations`, corps `{ "adherent_id": 12 }`.

- 201 + Location de la ressource créée : réservation ou inscription en attente.
  Le corps distingue explicitement les deux résultats.
- 400 : JSON illisible ou paramètres de requête mal formés.
- 422 : corps lisible mais invalide, avec tous les champs fautifs.
- 404 : créneau ou adhérent introuvable.
- 409 : doublon, fenêtre fermée, abonnement non valable ou quota atteint.

Le quota atteint est traité comme un conflit avec l'état courant (409).
La fiche S3 le donne en exemple de 422 : cette différence sera explicitement
justifiée dans la conception et la préparation de l'oral.

### Annulation et attente

- Annulation avant le début du créneau, conservée dans l'historique.
- Répéter l'annulation d'une réservation annulée retourne son état annulé.
- Une annulation libère le quota et déclenche la promotion du premier adhérent
  encore éligible, selon l'ordre `cree_le,id`.
- Une attente devenue inéligible est retirée avec un motif conservé ; le suivant
  est alors examiné. Le rang est calculé, pas entretenu comme compteur mutable.
- Annulation et promotion sont atomiques.

### Concurrence

Transactions, verrous et contraintes SQL doivent protéger ensemble la capacité,
les doublons et le quota, y compris pour deux créneaux différents réservés
simultanément par un même adhérent. Le détail de l'ordre des verrous sera défini
avant l'implémentation et documenté pour éviter les interblocages.

## Contrats transversaux

- Collections ordinaires : pagination offset, enveloppe cohérente et liens.
- Créneaux : filtres combinables cours/coach/jour, tri stable `debut,id` par défaut.
- Historique des réservations : curseur sur `cree_le,id` décroissant.
- Fiche cours : ETag, If-None-Match et réponse 304 sans corps.
- Modification d'un cours : contrôle atomique d'If-Match lorsqu'il est fourni,
  réponse 412 si obsolète.
- Toutes les écritures validées ; champs inconnus rejetés.
- Erreurs centralisées en application/problem+json, sans stack trace exposée.

## Critères de fin

- Démarrage documenté par une commande depuis un clone.
- Deux CRUD complets démontrables depuis une collection de requêtes versionnée.
- Collection filtrée, triée et paginée.
- Tests HTTP exécutables d'une commande, cas nominaux et erreurs.
- Même adhérent envoyé deux fois simultanément : une création et un 409.
- Deux adhérents sur la dernière place : une confirmation et une attente.
- Protection du quota lors de demandes simultanées sur deux créneaux.
- Parcours par curseur avec insertion entre les pages, comparaison avec offset.
- Captures reproductibles des réponses 304, 412 et des erreurs multi-champs.
- Données de démonstration utilisables le jour de l'oral.
- Documentation fidèle au code, scénario de démonstration de dix minutes et
  entraînement aux questions de fondamentaux et de raisonnement.

## Précisions techniques à résoudre pendant la conception détaillée

Ces points ne remettent pas en cause les règles validées : convention du kit
pour la formule illimitée, stratégie de données datées, représentation des attentes
retirées et des motifs, modification d'un cours ayant déjà des réservations.
Les choix retenus seront documentés avec l'implémentation.
