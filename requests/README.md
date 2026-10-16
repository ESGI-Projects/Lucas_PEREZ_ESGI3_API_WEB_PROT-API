# Requêtes de démonstration

- `salle-de-sport.postman_collection.json` : collection Postman v2.1 importable dans
  Insomnia (Import → File) ou Postman.
- `parcours.http` : mêmes opérations en texte HTTP, avec variables en tête.
- `../docs/captures/demo.json` : véritables échanges du scénario automatisé,
  dont validation multi-champs, 304, 412 et concurrence.

L'import de collections Postman est documenté par
[Kong / Insomnia](https://developer.konghq.com/insomnia/import-export/).

Lancer d'abord `docker compose up --build -d api`. Pour les dossiers 01 à 06,
`docker compose --profile tools run --build --rm demo` crée des données neuves :
reporter les identifiants affichés, le jour local et les instants du créneau dans
les variables de la collection. Pour les ETag, lire la fiche et copier l'en-tête
exact, guillemets compris ; après une modification réussie, l'ancien tag donne 412.
Le dossier de démo ci-dessous n'a pas besoin de cette étape.

Les valeurs initiales des variables sont des exemples, pas des identifiants
universels. Pour démontrer les suppressions CRUD, créer des ressources dédiées
sans relations ; les ressources du kit peuvent légitimement renvoyer 409.
Le créneau de démonstration a une capacité de 1. La commande demo le remplit et
joue ensuite l'annulation/promotion : utiliser les captures pour revoir chaque
état, ou relancer une démo pour obtenir des ressources neuves.

La concurrence se démontre par le script, qui lance les requêtes avec
`Promise.all`, plutôt que par deux clics successifs. Les tests ajoutent le cas du
quota sur deux créneaux différents et les annulations concurrentes.

## Démo de soutenance

La variable `base_url` de la collection vaut `http://localhost:3000`.
Dans une collection déjà importée, la modifier dans Insomnia : le fichier JSON ne
met pas à jour un import existant.

Le dossier `★ Démo soutenance (dans l'ordre)` regroupe les requêtes D00 à D12 dans
l'ordre du passage : santé, CRUD adhérent, ETag, planning paginé, erreurs 422 et
400, puis cache 304 et 412. Il suppose une base neuve
(`docker compose --profile test --profile tools down -v`, puis
`docker compose up --build -d api`) : l'adhérent créé porte alors l'id 81
(variable `demo_adherent`) et le cours 1 est en version 1 (variable `etag` =
`"cours-1-v1"`). Sinon, reporter l'id renvoyé dans `Location` et l'ETag affiché
par D06 dans ces deux variables.

Le planning filtre le coach 8 le 2026-10-06 avec `limit=2` : les créneaux 8 et 9
commencent tous deux à 10:15, l'id les départage entre la page 1 et la page 2.
