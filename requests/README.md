# Requêtes de démonstration

- `salle-de-sport.postman_collection.json` : collection Postman v2.1 importable dans
  Insomnia (Import → File) ou Postman.
- `parcours.http` : mêmes opérations en texte HTTP, avec variables en tête.
- `../docs/captures/demo.json` : véritables échanges du scénario automatisé,
  dont validation multi-champs, 304, 412 et concurrence.

L'import de collections Postman est documenté par
[Kong / Insomnia](https://developer.konghq.com/insomnia/import-export/).
L'import graphique n'a pas été exécuté dans cet environnement sans interface.

Lancer d'abord `docker compose up --build -d api`, puis
`docker compose --profile tools run --build --rm demo`.
Reporter les identifiants affichés, le jour local et les instants du créneau dans
les variables de la collection. Pour les ETag, lire la fiche et copier l'en-tête
exact, guillemets compris ; après une modification réussie, l'ancien tag donne 412.

Les valeurs initiales des variables sont des exemples, pas des identifiants
universels. Pour démontrer les suppressions CRUD, créer des ressources dédiées
sans relations ; les ressources du kit peuvent légitimement renvoyer 409.
Le créneau de démonstration a une capacité de 1. La commande demo le remplit et
joue ensuite l'annulation/promotion : utiliser les captures pour revoir chaque
état, ou relancer une démo pour obtenir des ressources neuves.

La concurrence se démontre par le script, qui lance les requêtes avec
`Promise.all`, plutôt que par deux clics successifs. Les tests ajoutent le cas du
quota sur deux créneaux différents et les annulations concurrentes.

## Accès depuis le PC via VPN

La VM actuelle du LAB a l'adresse privée `192.168.50.117`.
La variable `base_url` de la collection est préconfigurée sur
`http://192.168.50.117:3000`. Dans une collection déjà importée, modifier cette
variable dans Insomnia : le fichier JSON ne met pas à jour l'import existant.
Tester d'abord `GET http://192.168.50.117:3000/health` depuis le PC connecté au VPN.

La configuration locale `.env` de la VM fixe `API_BIND_ADDRESS=192.168.50.117`.
Le défaut du dépôt reste `127.0.0.1` pour un lancement local. Sur un autre poste,
adapter l'adresse d'écoute et la variable du client. Si l'adresse DHCP de la VM
change, adapter ces deux valeurs ; une réservation DHCP permet de la stabiliser.
