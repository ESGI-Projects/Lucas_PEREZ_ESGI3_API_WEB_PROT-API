-- Kit de données - Sujet 1 : bibliothèque municipale (SQLite)
-- Point de départ : adaptez-le à votre docs/api-design.md.
PRAGMA foreign_keys = ON;

CREATE TABLE auteurs (
  id   INTEGER PRIMARY KEY,
  nom  VARCHAR(100) NOT NULL
);

CREATE TABLE ouvrages (
  id     INTEGER PRIMARY KEY,
  titre  VARCHAR(200) NOT NULL,
  isbn   VARCHAR(17) NOT NULL,
  annee  INTEGER NOT NULL
);

-- un ouvrage a un ou plusieurs auteurs
CREATE TABLE ouvrages_auteurs (
  ouvrage_id  INTEGER NOT NULL REFERENCES ouvrages (id),
  auteur_id   INTEGER NOT NULL REFERENCES auteurs (id),
  PRIMARY KEY (ouvrage_id, auteur_id)
);

CREATE TABLE exemplaires (
  id            INTEGER PRIMARY KEY,
  ouvrage_id    INTEGER NOT NULL REFERENCES ouvrages (id),
  etat          VARCHAR(10) NOT NULL CHECK (etat IN ('neuf', 'bon', 'use', 'abime')),
  localisation  VARCHAR(20) NOT NULL
);

CREATE TABLE adherents (
  id     INTEGER PRIMARY KEY,
  nom    VARCHAR(100) NOT NULL,
  email  VARCHAR(254) NOT NULL,
  actif  INTEGER NOT NULL CHECK (actif IN (0, 1))
);

-- rendu_le NULL = emprunt en cours
CREATE TABLE emprunts (
  id             INTEGER PRIMARY KEY,
  exemplaire_id  INTEGER NOT NULL REFERENCES exemplaires (id),
  adherent_id    INTEGER NOT NULL REFERENCES adherents (id),
  du             DATE NOT NULL,
  au             DATE NOT NULL,
  rendu_le       DATE
);

CREATE TABLE reservations (
  id           INTEGER PRIMARY KEY,
  ouvrage_id   INTEGER NOT NULL REFERENCES ouvrages (id),
  adherent_id  INTEGER NOT NULL REFERENCES adherents (id),
  cree_le      DATE NOT NULL,
  statut       VARCHAR(20) NOT NULL CHECK (statut IN ('en_attente', 'disponible', 'honoree', 'annulee'))
);
