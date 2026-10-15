# Préparation de la soutenance

Ce document propose un entraînement, pas la banque officielle des questions.
La grille fournie prévoit quatre questions tirées au sort : deux fondamentaux et
deux cas limites, à deux points chacune. Il faudra travailler ces réponses ensemble
et savoir retrouver les mécanismes dans le code, sans réciter ce fichier.

## Déroulé de dix minutes

| Temps    | Démonstration                                                      | Message à faire passer                                                            |
| -------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 0–2 min  | Montrer app.ts, un module, le modèle                               | Les responsabilités sont séparées ; attente et réservation partagent un invariant |
| 2–5 min  | CRUD adhérent/cours, planning filtré/trié/paginé, lancer les tests | Les verbes, statuts, Location et enveloppes sont cohérents                        |
| 5–8 min  | 422 multi-champs, script concurrent, 304 et 412                    | Les erreurs sont exploitables et les décisions concurrentes sont atomiques        |
| 8–10 min | api-design, curseur/offset, choix et limites                       | Chaque choix répond à un problème concret                                         |

Avant le premier passage : démarrer avec le README devant le professeur.
Préparer les onglets et variables du client. Exécuter la commande demo à l'avance
pour disposer des captures datées, puis la rejouer en live avec de nouvelles données.
Conserver aussi la sortie de la commande de tests dans `docs/captures/tests.txt`.
Le lancement, le déroulé et la compréhension doivent encore être répétés avec
l'utilisateur ; des fichiers prêts ne remplacent pas cet entraînement.

## Six fondamentaux

### F1 — Pourquoi ce projet vise-t-il le niveau 2 de Richardson ?

Les ressources sont identifiées par des URI, les méthodes ont leur sens HTTP et
les statuts distinguent les résultats. GET lit, POST crée, PATCH modifie ; une
création renvoie 201 et une erreur n'est pas déguisée en 200. Les liens de pagination
ajoutent de la navigation, sans constituer à eux seuls une API entièrement HATEOAS.

À montrer : tableau HTTP dans api-design et route de création d'adhérent.

### F2 — PUT et PATCH : quelle différence ?

PUT remplace la représentation métier ; notre contrat exige tous ses champs
obligatoires. PATCH modifie seulement les champs fournis. Un PUT incomplet est
refusé en 422, tandis que PATCH préserve les champs absents. Sur les cours, on
revalide les dates après fusion du PATCH avec les valeurs actuelles.

Relance possible : PATCH est-il idempotent ? Pas par définition générale ; une
modification « fixe le nom à X » peut l'être, une opération « incrémente de 1 » non.

### F3 — 400, 422, 404, 409 et 412 : comment choisir ?

400 : syntaxe JSON ou paramètre illisible. 422 : champs du corps invalides.
404 : ressource introuvable. 409 : conflit avec l'état courant, comme un doublon
actif ou un quota atteint. 412 : précondition HTTP fournie par le client devenue
fausse, comme un If-Match obsolète. Expliquer le choix du quota en 409 malgré
l'exemple 422 de la fiche S3, avec la distinction métier de S4.

À montrer : une réponse problem+json avec type, title, status, detail, instance
et errors pour les champs. Le handler protège aussi les erreurs inattendues.

### F4 — Pourquoi un tri stable et quel rôle joue id ?

Plusieurs créneaux peuvent avoir la même date. Trier uniquement par date ne fixe
pas leur ordre relatif. Ajouter un identifiant unique donne un ordre total et une
position de curseur non ambiguë. Cela ne protège pas une pagination offset contre
le déplacement dû aux insertions.

### F5 — DELETE reste-t-il idempotent s'il répond 204 puis 404 ?

Oui. L'idempotence concerne l'effet attendu de répétitions identiques sur le serveur,
pas l'identité des réponses. Après la première suppression, la ressource reste
absente. Une méthode sûre, comme GET, ne demande pas de modification métier.
Une méthode idempotente, comme DELETE, peut modifier l'état.

### F6 — À quoi servent ETag, If-None-Match et If-Match ?

ETag identifie une version de la représentation. If-None-Match permet une lecture
conditionnelle : même version → 304 sans corps, le client réutilise son cache.
If-Match protège une écriture : version obsolète → 412, il faut relire et décider
comment fusionner. Le serveur doit comparer et écrire atomiquement.
Un ETag n'est ni une authentification ni un verrou conservé entre deux requêtes.

## Six cas limites

### C1 — Deux clients voient la dernière place. Pourquoi compter puis insérer ne suffit pas ?

Ils peuvent lire le même compteur avant que l'autre n'insère. Une transaction
sérialisable et le verrou du créneau ordonnent la décision complète : vérifier,
choisir confirmation ou attente, écrire. Le second observe un résultat compatible
après la fin ou la reprise de sa transaction. On obtient une confirmation et une
attente, pas deux confirmations. Un verrou en mémoire du processus ne protégerait
pas plusieurs instances de l'API.

À montrer : transaction.ts et reservations.service.ts, test dernière place.

### C2 — Verrouiller le créneau suffit-il pour le quota ?

Non : le même adhérent peut viser deux créneaux différents. Il faut aussi coordonner
ses décisions de quota, ici via le verrou de l'adhérent et l'isolation sérialisable.
La semaine est celle du créneau en Europe/Paris, pas celle du clic ni une semaine UTC.
Le test sur deux créneaux prouve le cas. L'attente ne consomme pas de quota.

### C3 — Que faire d'une erreur de sérialisation ou d'un interblocage ?

Annuler et rejouer toute la transaction avec un nouveau snapshot. Un simple rejeu
de l'INSERT ne revaliderait pas les décisions. Les verrous suivent un ordre stable,
mais on gère quand même les codes PostgreSQL 40001 et 40P01 avec une limite de
reprises. Aucun mail ou effet externe ne doit être déclenché dans le callback
rejouable. Après la limite, 503 invite le client à réessayer.

### C4 — Une personne en attente a consommé son quota ailleurs. Est-elle promue ?

Non. L'éligibilité est recalculée au moment de la promotion. La première devenue
inéligible est retirée avec motif, puis on examine la suivante. Annulation et
promotion sont atomiques ; deux annulations du même identifiant ne peuvent pas
promouvoir deux personnes pour une seule place.

### C5 — Une réservation est insérée entre deux pages. Que change le curseur ?

En offset, l'insertion avant la position décale les indices : un élément déjà lu
peut réapparaître. Avec un curseur cree_le,id, on demande les éléments strictement
après la position dans le tri décroissant. Les nouvelles réservations plus récentes
seront vues lors d'un nouveau parcours. Ce n'est pas un snapshot et une suppression
peut toujours retirer un élément du parcours. Préserver les microsecondes évite de
fausser la comparaison avec PostgreSQL.

### C6 — La réponse d'un POST est perdue : le client peut-il recommencer sans risque ?

POST n'est pas idempotent par défaut. La première demande peut avoir abouti malgré
la perte de réponse. Ici, l'unicité active empêche la double inscription et le rejeu
peut renvoyer 409 ; cela ne rejoue pas à l'identique la première réponse. Le client
peut consulter ses inscriptions. Une clé d'idempotence persistée serait une autre
solution, non implémentée dans ce périmètre. Ne pas confondre cet échec réseau avec
la reprise interne d'une transaction qui n'a pas été validée.

## Notions supplémentaires à savoir raisonner

La grille précise que les questions de diagnostic peuvent porter sur des séances
non réalisées sans pénaliser leur absence une seconde fois.

- **401 / 403** : 401 pour une authentification absente ou invalide ; 403 pour une
  identité reconnue qui n'a pas le droit. Connaître l'identifiant d'une réservation
  ne doit pas suffire à l'annuler dans une API protégée. Une vérification de propriété
  doit se faire côté serveur, pas en faisant confiance à adherent_id du corps.
- **OpenAPI** : décrit le contrat, schémas, statuts et en-têtes ; une spec valide
  syntaxiquement peut être en désaccord avec l'API. Distinguer documentation et test
  de contrat. Rien d'OpenAPI n'est livré ici.
- **429** : signale une limitation de requêtes ; Retry-After indique quand réessayer.
  Limiter les appels ne remplace pas la protection transactionnelle de la capacité.
- **CORS** : règle les lectures autorisées par les navigateurs entre origines ;
  ne remplace ni l'authentification ni l'autorisation et ne bloque pas curl.
- **Changement d'heure** : sept jours calendaires à Paris ne représentent pas
  toujours 168 heures. Un abonnement porte des dates civiles ; un créneau porte
  des instants. Le code utilise ces deux types de données selon leur sens.

## Méthode d'entraînement à faire ensemble

Pour chaque mécanisme : l'expliquer sans regarder, montrer le fichier concerné,
prédire la réponse d'une requête, puis modifier mentalement une condition.
Pour une question à deux volets, traiter explicitement les deux ; une justification
n'est pas nécessairement un second volet. Répondre d'abord au cas posé, puis donner
la raison et un exemple de ce projet. Dire clairement ce qui est implémenté et ce
qui serait une évolution.
