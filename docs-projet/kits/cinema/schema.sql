-- Kit de données - Sujet 2 : cinéma / billetterie (SQLite)
-- Point de départ : adaptez-le à votre docs/api-design.md.
PRAGMA foreign_keys = ON;

CREATE TABLE films (
  id              INTEGER PRIMARY KEY,
  titre           VARCHAR(200) NOT NULL,
  duree_min       INTEGER NOT NULL,
  classification  VARCHAR(3) NOT NULL CHECK (classification IN ('TP', '-12', '-16', '-18'))
);

CREATE TABLE salles (
  id        INTEGER PRIMARY KEY,
  nom       VARCHAR(50) NOT NULL,
  capacite  INTEGER NOT NULL
);

-- plan de salle : un siège = une rangée + un numéro (code lisible : A12)
CREATE TABLE sieges (
  id        INTEGER PRIMARY KEY,
  salle_id  INTEGER NOT NULL REFERENCES salles (id),
  code      VARCHAR(5) NOT NULL,
  rangee    VARCHAR(2) NOT NULL,
  numero    INTEGER NOT NULL
);

-- debut en UTC
CREATE TABLE seances (
  id        INTEGER PRIMARY KEY,
  film_id   INTEGER NOT NULL REFERENCES films (id),
  salle_id  INTEGER NOT NULL REFERENCES salles (id),
  debut     TIMESTAMP NOT NULL
);

CREATE TABLE clients (
  id     INTEGER PRIMARY KEY,
  nom    VARCHAR(100) NOT NULL,
  email  VARCHAR(254) NOT NULL
);

CREATE TABLE reservations (
  id         INTEGER PRIMARY KEY,
  seance_id  INTEGER NOT NULL REFERENCES seances (id),
  client_id  INTEGER NOT NULL REFERENCES clients (id),
  statut     VARCHAR(10) NOT NULL CHECK (statut IN ('held', 'confirmed', 'cancelled', 'expired')),
  cree_le    TIMESTAMP NOT NULL,
  expire_le  TIMESTAMP
);

CREATE TABLE reservations_sieges (
  reservation_id  INTEGER NOT NULL REFERENCES reservations (id),
  siege_id        INTEGER NOT NULL REFERENCES sieges (id),
  PRIMARY KEY (reservation_id, siege_id)
);

-- paiements simulés ; montants en centimes
CREATE TABLE paiements (
  id              INTEGER PRIMARY KEY,
  reservation_id  INTEGER NOT NULL REFERENCES reservations (id),
  montant         INTEGER NOT NULL,
  statut          VARCHAR(10) NOT NULL CHECK (statut IN ('en_attente', 'accepte', 'refuse', 'rembourse')),
  cree_le         TIMESTAMP NOT NULL
);
