CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE adherents ADD CONSTRAINT adherents_email_unique UNIQUE (email);
ALTER TABLE abonnements ADD CONSTRAINT abonnement_dates CHECK (fin >= debut);
ALTER TABLE abonnements ADD CONSTRAINT abonnement_quota CHECK (quota_hebdo > 0);
ALTER TABLE abonnements ADD CONSTRAINT abonnement_sans_chevauchement
  EXCLUDE USING gist (adherent_id WITH =, daterange(debut, fin, '[]') WITH &&);
ALTER TABLE cours ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE cours ADD CONSTRAINT cours_capacite CHECK (capacite > 0);
ALTER TABLE cours ADD CONSTRAINT cours_duree CHECK (duree_min > 0);
ALTER TABLE cours ADD CONSTRAINT cours_periode CHECK (periode_fin >= periode_debut);
ALTER TABLE creneaux ADD COLUMN capacite INTEGER;
UPDATE creneaux SET capacite = cours.capacite FROM cours WHERE cours.id = creneaux.cours_id;
ALTER TABLE creneaux ALTER COLUMN capacite SET NOT NULL;
ALTER TABLE creneaux ADD CONSTRAINT creneau_capacite CHECK (capacite > 0);
ALTER TABLE creneaux ADD CONSTRAINT creneau_dates CHECK (fin > debut);
-- La capacité de l'occurrence est figée à sa création. Changer un cours ne
-- modifie donc pas les engagements pris sur des occurrences existantes.
ALTER TABLE creneaux DROP COLUMN places_prises;

ALTER TABLE reservations DROP CONSTRAINT reservations_statut_check;
ALTER TABLE reservations ALTER COLUMN statut TYPE VARCHAR(16);
ALTER TABLE reservations ADD CONSTRAINT reservations_statut_check
  CHECK (statut IN ('confirmee', 'annulee', 'en_attente', 'retiree'));
ALTER TABLE reservations ADD COLUMN motif TEXT;
ALTER TABLE reservations ALTER COLUMN cree_le SET DEFAULT clock_timestamp();
INSERT INTO reservations (creneau_id, adherent_id, statut, cree_le)
 SELECT creneau_id, adherent_id, 'en_attente', cree_le FROM listes_attente;
DROP TABLE listes_attente;
CREATE UNIQUE INDEX inscription_active_unique ON reservations (creneau_id, adherent_id)
 WHERE statut IN ('confirmee', 'en_attente');
CREATE INDEX reservations_historique ON reservations (cree_le DESC, id DESC);
CREATE INDEX reservations_adherent ON reservations (adherent_id, creneau_id) WHERE statut = 'confirmee';
CREATE INDEX creneaux_planning ON creneaux (debut, id);
CREATE VIEW listes_attente AS
 SELECT id, creneau_id, adherent_id, cree_le, statut, motif,
   CASE WHEN statut = 'en_attente' THEN
     count(*) FILTER (WHERE statut = 'en_attente') OVER
       (PARTITION BY creneau_id ORDER BY cree_le, id)::integer
   ELSE NULL END AS rang
 FROM reservations WHERE statut IN ('en_attente', 'retiree');
