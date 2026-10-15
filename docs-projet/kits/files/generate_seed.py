#!/usr/bin/env python3
"""Génère les kits de données (SQLite + JSON) des 3 sujets fil rouge - Web API, 3ESGI-AL.

NON DISTRIBUÉ. Produit pour chaque sujet : schema.sql, seed.sql, seed.json, README.md.

Usage :
  python3 supports/kits/files/generate_seed.py                    # semaine de référence 2026-10-05
  python3 supports/kits/files/generate_seed.py --debut 2026-10-12 # régénérer pour la semaine de S2

Déterministe : même --debut => fichiers identiques. Stdlib uniquement (zoneinfo : tzdata requis).

Règle de conception : aucune contrainte qui résout le piège de S4 ou la validation de S3
(pas d'index unique « un emprunt actif par exemplaire », pas de UNIQUE (séance, siège), pas de
CHECK places_prises <= capacite, pas de UNIQUE (créneau, adhérent), pas de CHECK de format
ISBN / email). Voir le guide enseignant S2.
"""
import argparse
import json
import random
import unicodedata
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

KITS = Path(__file__).resolve().parent.parent
PARIS = ZoneInfo("Europe/Paris")
GRAINE = 20260914

PRENOMS = [
    "Camille", "Léa", "Hugo", "Louis", "Chloé", "Nathan", "Inès", "Jules", "Manon", "Lucas",
    "Sarah", "Gabriel", "Emma", "Arthur", "Zoé", "Adam", "Lina", "Raphaël", "Jade", "Noah",
    "Alice", "Tom", "Clara", "Samuel", "Rose", "Yanis", "Mila", "Théo", "Nora", "Malik",
    "Anaïs", "Karim", "Elsa", "Sacha", "Lou", "Ibrahim", "Maëlle", "Victor", "Salomé", "Enzo",
]
NOMS = [
    "Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy",
    "Moreau", "Simon", "Laurent", "Lefebvre", "Michel", "Garcia", "David", "Bertrand", "Roux",
    "Vincent", "Fournier", "Morel", "Girard", "André", "Mercier", "Blanc", "Guérin", "Boyer",
    "Garnier", "Chevalier", "François", "Legrand", "Gauthier", "Perrin", "Robin", "Clément",
    "Morin", "Nicolas", "Henry", "Roussel", "Mathieu",
]


# ---------------------------------------------------------------------------------------------
# Utilitaires
# ---------------------------------------------------------------------------------------------

def slug(texte):
    sans_accents = unicodedata.normalize("NFKD", texte).encode("ascii", "ignore").decode()
    return sans_accents.lower().replace(" ", "-").replace("'", "")


def personnes(rng, n):
    """n couples (nom complet, email) tous distincts."""
    combos = [(p, nom) for p in PRENOMS for nom in NOMS]
    rng.shuffle(combos)
    return [(f"{p} {nom}", f"{slug(p)}.{slug(nom)}@example.org") for p, nom in combos[:n]]


def utc(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def heure_locale(jour, hhmm):
    h, m = map(int, hhmm.split(":"))
    return datetime.combine(jour, time(h, m), tzinfo=PARIS)


def isbn13(rng):
    chiffres = [9, 7, 8] + [rng.randrange(10) for _ in range(9)]
    somme = sum(c * (1 if i % 2 == 0 else 3) for i, c in enumerate(chiffres))
    return "".join(map(str, chiffres)) + str((10 - somme % 10) % 10)


# ---------------------------------------------------------------------------------------------
# Sujet 1 - Bibliothèque municipale
# ---------------------------------------------------------------------------------------------

DDL_BIBLIOTHEQUE = """\
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
"""

TITRE_DEBUTS = [
    "Les Jardins", "La Maison", "Le Silence", "Les Ombres", "La Route", "Le Chant", "Les Nuits",
    "La Mémoire", "Le Rivage", "Les Enfants", "La Lumière", "Le Voyage", "Les Heures",
    "La Promesse", "Le Secret", "Les Saisons", "La Ville", "Le Dernier Hiver", "Les Oiseaux",
    "La Frontière",
]
TITRE_FINS = [
    "de Brume", "du Nord", "d'Argile", "de l'Aube", "sans Nom", "des Marées", "de Verre",
    "du Vieux Port", "d'Octobre", "des Collines", "de Sel", "du Phare", "des Absents", "de Cendre",
    "du Sud", "des Étoiles", "de Papier", "du Fleuve", "d'Ailleurs", "des Glaces",
]


def kit_bibliotheque(rng, lundi):
    auteurs = [{"id": i, "nom": nom} for i, (nom, _) in enumerate(personnes(rng, 120), 1)]

    combos = [f"{a} {b}" for a in TITRE_DEBUTS for b in TITRE_FINS]
    rng.shuffle(combos)
    uniques = combos[:380]
    titres = uniques + rng.sample(uniques, 20)  # 20 rééditions : titres en doublon (tri stable)
    rng.shuffle(titres)

    ouvrages, liens, exemplaires, isbns = [], [], [], set()
    for oid, titre in enumerate(titres, 1):
        isbn = isbn13(rng)
        while isbn in isbns:
            isbn = isbn13(rng)
        isbns.add(isbn)
        ouvrages.append({"id": oid, "titre": titre, "isbn": isbn, "annee": rng.randint(1950, 2025)})
        for aid in sorted(rng.sample(range(1, len(auteurs) + 1), rng.choice([1, 1, 1, 2]))):
            liens.append({"ouvrage_id": oid, "auteur_id": aid})
        for _ in range(rng.randint(1, 3)):
            exemplaires.append({
                "id": len(exemplaires) + 1,
                "ouvrage_id": oid,
                "etat": rng.choice(["neuf", "bon", "bon", "use", "abime"]),
                "localisation": f"{rng.choice(['ROM', 'POL', 'SF', 'JEU', 'DOC', 'BD'])}-{rng.randint(1, 40):02d}",
            })

    adherents = [
        {"id": i, "nom": nom, "email": email, "actif": 0 if i % 10 == 0 else 1}
        for i, (nom, email) in enumerate(personnes(rng, 50), 1)
    ]
    actifs = [a["id"] for a in adherents if a["actif"]]

    # exemplaires disjoints entre historique et emprunts en cours : aucun chevauchement
    tires = rng.sample([e["id"] for e in exemplaires], 300)
    brut = []
    for ex in tires[:240]:  # historique rendu
        du = lundi - timedelta(days=rng.randint(40, 400))
        brut.append((du, ex, du + timedelta(days=21), du + timedelta(days=rng.randint(3, 25))))
    for ex in tires[240:290]:  # en cours, dans les temps
        du = lundi - timedelta(days=rng.randint(1, 20))
        brut.append((du, ex, du + timedelta(days=21), None))
    for ex in tires[290:]:  # en retard
        du = lundi - timedelta(days=rng.randint(25, 40))
        brut.append((du, ex, du + timedelta(days=21), None))
    brut.sort(key=lambda t: (t[0], t[1]))
    emprunts = [
        {
            "id": i, "exemplaire_id": ex, "adherent_id": rng.choice(actifs),
            "du": du.isoformat(), "au": au.isoformat(),
            "rendu_le": rendu.isoformat() if rendu else None,
        }
        for i, (du, ex, au, rendu) in enumerate(brut, 1)
    ]

    ouvrage_de = {e["id"]: e["ouvrage_id"] for e in exemplaires}
    empruntes = sorted({ouvrage_de[e["exemplaire_id"]] for e in emprunts if e["rendu_le"] is None})
    reservations, vus = [], set()
    while len(reservations) < 20:
        cle = (rng.choice(empruntes), rng.choice(actifs))
        if cle in vus:
            continue
        vus.add(cle)
        reservations.append({
            "id": len(reservations) + 1, "ouvrage_id": cle[0], "adherent_id": cle[1],
            "cree_le": (lundi - timedelta(days=rng.randint(0, 10))).isoformat(),
            "statut": rng.choice(["en_attente"] * 4 + ["annulee"]),
        })

    return {
        "auteurs": auteurs, "ouvrages": ouvrages, "ouvrages_auteurs": liens,
        "exemplaires": exemplaires, "adherents": adherents, "emprunts": emprunts,
        "reservations": reservations,
    }


# ---------------------------------------------------------------------------------------------
# Sujet 2 - Cinéma / billetterie
# ---------------------------------------------------------------------------------------------

DDL_CINEMA = """\
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
"""

FILM_DEBUTS = ["L'Ombre", "Le Retour", "La Nuit", "Mission", "Le Dernier Témoin", "Les Gardiens",
               "Horizon", "La Chute", "Le Souffle", "Opération"]
FILM_FINS = ["du Désert", "de Minuit", "de l'Orage", "des Profondeurs", "du Large", "de Glace",
             "de Feu", "du Ciel", "de Pierre", "des Sables"]
HORAIRES_CINEMA = ["14:00", "17:30", "21:00"]


def kit_cinema(rng, lundi):
    titres = rng.sample([f"{a} {b}" for a in FILM_DEBUTS for b in FILM_FINS], 20)
    films = [
        {"id": i, "titre": t, "duree_min": rng.randint(85, 160),
         "classification": rng.choice(["TP", "TP", "TP", "-12", "-12", "-16", "-18"])}
        for i, t in enumerate(titres, 1)
    ]

    plans = [("Salle 1", 6, 10), ("Salle 2", 8, 10), ("Salle 3", 8, 12), ("Grande salle", 10, 14)]
    salles, sieges = [], []
    sieges_de = defaultdict(list)
    for sid, (nom, rangees, par_rangee) in enumerate(plans, 1):
        salles.append({"id": sid, "nom": nom, "capacite": rangees * par_rangee})
        for r in range(rangees):
            lettre = chr(ord("A") + r)
            for n in range(1, par_rangee + 1):
                siege = {"id": len(sieges) + 1, "salle_id": sid, "code": f"{lettre}{n}",
                         "rangee": lettre, "numero": n}
                sieges.append(siege)
                sieges_de[sid].append(siege["id"])

    seances = []
    for jour in range(-14, 70):  # 2 semaines d'historique + 10 semaines à venir
        d = lundi + timedelta(days=jour)
        for salle in salles:
            for hhmm in HORAIRES_CINEMA:
                seances.append({"id": len(seances) + 1, "film_id": rng.choice(films)["id"],
                                "salle_id": salle["id"], "debut": utc(heure_locale(d, hhmm))})

    clients = [{"id": i, "nom": nom, "email": email}
               for i, (nom, email) in enumerate(personnes(rng, 40), 1)]

    maintenant = heure_locale(lundi, "09:00")
    pris = defaultdict(set)  # seance_id -> sièges confirmés
    reservations, liens, paiements = [], [], []
    for _ in range(260):
        seance = rng.choice(seances)
        libres = [s for s in sieges_de[seance["salle_id"]] if s not in pris[seance["id"]]]
        choisis = sorted(rng.sample(libres, rng.randint(1, 4)))
        statut = "cancelled" if rng.random() < 0.1 else "confirmed"
        if statut == "confirmed":
            pris[seance["id"]].update(choisis)
        debut = datetime.strptime(seance["debut"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        cree = min(debut, maintenant) - timedelta(hours=rng.randint(2, 96))
        rid = len(reservations) + 1
        reservations.append({"id": rid, "seance_id": seance["id"],
                             "client_id": rng.choice(clients)["id"], "statut": statut,
                             "cree_le": utc(cree), "expire_le": None})
        liens.extend({"reservation_id": rid, "siege_id": s} for s in choisis)
        paiements.append({"id": len(paiements) + 1, "reservation_id": rid,
                          "montant": 950 * len(choisis),
                          "statut": "accepte" if statut == "confirmed" else "rembourse",
                          "cree_le": utc(cree + timedelta(minutes=5))})

    return {
        "films": films, "salles": salles, "sieges": sieges, "seances": seances,
        "clients": clients, "reservations": reservations, "reservations_sieges": liens,
        "paiements": paiements,
    }


# ---------------------------------------------------------------------------------------------
# Sujet 3 - Salle de sport
# ---------------------------------------------------------------------------------------------

DDL_SALLE_DE_SPORT = """\
-- Kit de données - Sujet 3 : salle de sport (SQLite)
-- Point de départ : adaptez-le à votre docs/api-design.md.
PRAGMA foreign_keys = ON;

CREATE TABLE adherents (
  id     INTEGER PRIMARY KEY,
  nom    VARCHAR(100) NOT NULL,
  email  VARCHAR(254) NOT NULL
);

CREATE TABLE abonnements (
  id           INTEGER PRIMARY KEY,
  adherent_id  INTEGER NOT NULL REFERENCES adherents (id),
  formule      VARCHAR(10) NOT NULL CHECK (formule IN ('essentiel', 'premium', 'illimite')),
  debut        DATE NOT NULL,
  fin          DATE NOT NULL,
  quota_hebdo  INTEGER NOT NULL
);

CREATE TABLE coachs (
  id     INTEGER PRIMARY KEY,
  nom    VARCHAR(100) NOT NULL,
  email  VARCHAR(254) NOT NULL
);

-- règle de récurrence : chaque semaine, jour_semaine (1 = lundi ... 7 = dimanche) à heure_debut
-- (heure locale du fuseau), entre periode_debut et periode_fin
CREATE TABLE cours (
  id             INTEGER PRIMARY KEY,
  type           VARCHAR(50) NOT NULL,
  coach_id       INTEGER NOT NULL REFERENCES coachs (id),
  capacite       INTEGER NOT NULL,
  jour_semaine   INTEGER NOT NULL CHECK (jour_semaine BETWEEN 1 AND 7),
  heure_debut    TIME NOT NULL,
  duree_min      INTEGER NOT NULL,
  periode_debut  DATE NOT NULL,
  periode_fin    DATE NOT NULL,
  fuseau         VARCHAR(64) NOT NULL
);

-- occurrences d'un cours ; debut et fin en UTC
CREATE TABLE creneaux (
  id             INTEGER PRIMARY KEY,
  cours_id       INTEGER NOT NULL REFERENCES cours (id),
  debut          TIMESTAMP NOT NULL,
  fin            TIMESTAMP NOT NULL,
  places_prises  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE reservations (
  id           INTEGER PRIMARY KEY,
  creneau_id   INTEGER NOT NULL REFERENCES creneaux (id),
  adherent_id  INTEGER NOT NULL REFERENCES adherents (id),
  statut       VARCHAR(10) NOT NULL CHECK (statut IN ('confirmee', 'annulee')),
  cree_le      TIMESTAMP NOT NULL
);

CREATE TABLE listes_attente (
  id           INTEGER PRIMARY KEY,
  creneau_id   INTEGER NOT NULL REFERENCES creneaux (id),
  adherent_id  INTEGER NOT NULL REFERENCES adherents (id),
  rang         INTEGER NOT NULL,
  cree_le      TIMESTAMP NOT NULL
);
"""

TYPES_COURS = ["Yoga", "Pilates", "Cross-training", "Spinning", "Boxe", "Zumba", "Stretching",
               "HIIT", "Body pump", "Aquagym"]
QUOTAS = {"essentiel": 2, "premium": 4, "illimite": 7}


def kit_salle_de_sport(rng, lundi):
    fin_fenetre = lundi + timedelta(days=14)
    if heure_locale(lundi, "00:00").utcoffset() != heure_locale(fin_fenetre, "00:00").utcoffset():
        raise SystemExit(
            f"La fenêtre {lundi} -> {fin_fenetre} traverse un changement d'heure (Europe/Paris) : "
            "choisissez une autre semaine avec --debut."
        )

    coachs = [{"id": i, "nom": nom, "email": email}
              for i, (nom, email) in enumerate(personnes(rng, 8), 1)]
    adherents = [{"id": i, "nom": nom, "email": email}
                 for i, (nom, email) in enumerate(personnes(rng, 80), 1)]

    abonnements, quota = [], {}
    for a in adherents:
        formule = rng.choice(["essentiel", "essentiel", "premium", "premium", "illimite"])
        debut = lundi - timedelta(days=rng.randint(30, 300))
        abonnements.append({"id": a["id"], "adherent_id": a["id"], "formule": formule,
                            "debut": debut.isoformat(),
                            "fin": (debut + timedelta(days=365)).isoformat(),
                            "quota_hebdo": QUOTAS[formule]})
        quota[a["id"]] = QUOTAS[formule]

    cours = []
    for i in range(1, 31):
        cours.append({
            "id": i, "type": TYPES_COURS[(i - 1) % len(TYPES_COURS)],
            "coach_id": rng.choice(coachs)["id"],
            "capacite": rng.choice([8, 10, 12, 15, 20]),
            "jour_semaine": rng.randint(1, 6),
            "heure_debut": rng.choice(["07:00", "09:00", "12:15", "18:00", "19:30"]),
            "duree_min": rng.choice([45, 60]),
            "periode_debut": (lundi - timedelta(days=28)).isoformat(),
            "periode_fin": (lundi + timedelta(days=84)).isoformat(),
            "fuseau": "Europe/Paris",
        })

    brut = []
    for semaine in (0, 1):
        for c in cours:
            jour = lundi + timedelta(days=7 * semaine + c["jour_semaine"] - 1)
            debut = heure_locale(jour, c["heure_debut"])
            brut.append((utc(debut), c["id"], utc(debut + timedelta(minutes=c["duree_min"])), semaine))
    brut.sort()
    creneaux = [{"id": i, "cours_id": cid, "debut": d, "fin": f, "places_prises": 0}
                for i, (d, cid, f, _) in enumerate(brut, 1)]
    semaine_de = {i: s for i, (_, _, _, s) in enumerate(brut, 1)}
    capacite = {c["id"]: c["capacite"] for c in cours}

    maintenant = heure_locale(lundi, "09:00")
    compte = defaultdict(int)  # (adherent, semaine) -> réservations confirmées
    reservations, attente = [], []
    ordre = creneaux[:]
    rng.shuffle(ordre)
    complets = {c["id"] for c in rng.sample(creneaux, 12)}
    ordre.sort(key=lambda c: c["id"] not in complets)  # remplir d'abord les créneaux visés complets
    for cr in ordre:
        cap = capacite[cr["cours_id"]]
        cible = cap if cr["id"] in complets else rng.randint(0, cap - 1)
        semaine = semaine_de[cr["id"]]
        candidats = [a["id"] for a in adherents if compte[(a["id"], semaine)] < quota[a["id"]]]
        rng.shuffle(candidats)
        inscrits = candidats[:cible]
        for aid in inscrits:
            compte[(aid, semaine)] += 1
            reservations.append({"creneau_id": cr["id"], "adherent_id": aid, "statut": "confirmee",
                                 "cree_le": utc(maintenant - timedelta(hours=rng.randint(1, 120)))})
        cr["places_prises"] = len(inscrits)
        autres = [a["id"] for a in adherents if a["id"] not in inscrits]
        if rng.random() < 0.3:  # une annulation passée
            reservations.append({"creneau_id": cr["id"], "adherent_id": rng.choice(autres),
                                 "statut": "annulee",
                                 "cree_le": utc(maintenant - timedelta(hours=rng.randint(1, 120)))})
        if len(inscrits) == cap:
            for rang, aid in enumerate(rng.sample(autres, rng.randint(1, 3)), 1):
                attente.append({"creneau_id": cr["id"], "adherent_id": aid, "rang": rang,
                                "cree_le": utc(maintenant - timedelta(hours=rng.randint(1, 48)))})

    reservations.sort(key=lambda r: (r["cree_le"], r["creneau_id"], r["adherent_id"]))
    attente.sort(key=lambda r: (r["creneau_id"], r["rang"]))
    reservations = [{"id": i, **r} for i, r in enumerate(reservations, 1)]
    attente = [{"id": i, **r} for i, r in enumerate(attente, 1)]

    return {
        "adherents": adherents, "abonnements": abonnements, "coachs": coachs, "cours": cours,
        "creneaux": creneaux, "reservations": reservations, "listes_attente": attente,
    }


# ---------------------------------------------------------------------------------------------
# Écriture
# ---------------------------------------------------------------------------------------------

def valeur_sql(v):
    if v is None:
        return "NULL"
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def seed_sql(titre, tables, lundi):
    lignes = [
        f"-- Kit de données - {titre} : données fictives générées.",
        f"-- Semaine de référence : {lundi.isoformat()}. À charger après schema.sql.",
        "PRAGMA foreign_keys = ON;",
        "BEGIN;",
    ]
    for table, rows in tables.items():
        colonnes = list(rows[0])
        for i in range(0, len(rows), 200):
            valeurs = ",\n".join(
                "  (" + ", ".join(valeur_sql(r[c]) for c in colonnes) + ")" for r in rows[i:i + 200]
            )
            lignes.append(f"INSERT INTO {table} ({', '.join(colonnes)}) VALUES\n{valeurs};")
    lignes.append("COMMIT;")
    return "\n".join(lignes) + "\n"


NOTES = {
    "bibliotheque": [
        "`emprunts.rendu_le` vaut `NULL` tant que l'exemplaire n'est pas rendu.",
        "Un ouvrage peut avoir plusieurs auteurs : table de liaison `ouvrages_auteurs`.",
    ],
    "cinema": [
        "Les séances couvrent 2 semaines passées et 10 semaines à venir.",
        "Montants en centimes. Paiements simulés.",
        "Un siège réservé est une ligne de `reservations_sieges`.",
    ],
    "salle-de-sport": [
        "Chaque cours porte sa règle de récurrence (`jour_semaine`, `heure_debut` en heure locale,"
        " `duree_min`, `periode_debut`, `periode_fin`, `fuseau`).",
        "`creneaux` contient les occurrences des 2 semaines à partir de la semaine de référence.",
    ],
}


def readme(nom, titre, tables, lundi):
    volumes = "\n".join(f"| `{t}` | {len(rows)} |" for t, rows in tables.items())
    notes = "\n".join(f"- {n}" for n in NOTES[nom])
    return f"""# Kit de données - {titre}

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
- Semaine de référence (le « maintenant » des données) : lundi {lundi.isoformat()}.
{notes}

## Volumes

| Table | Lignes |
|---|---|
{volumes}
"""


SUJETS = [
    ("bibliotheque", "Sujet 1 : bibliothèque municipale", DDL_BIBLIOTHEQUE, kit_bibliotheque),
    ("cinema", "Sujet 2 : cinéma / billetterie", DDL_CINEMA, kit_cinema),
    ("salle-de-sport", "Sujet 3 : salle de sport", DDL_SALLE_DE_SPORT, kit_salle_de_sport),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--debut", default="2026-10-05",
                        help="un jour de la semaine de référence (ramené au lundi)")
    args = parser.parse_args()
    jour = date.fromisoformat(args.debut)
    lundi = jour - timedelta(days=jour.weekday())

    for nom, titre, ddl, generer in SUJETS:
        rng = random.Random(f"{GRAINE}-{nom}")
        tables = generer(rng, lundi)
        dossier = KITS / nom
        dossier.mkdir(parents=True, exist_ok=True)
        (dossier / "schema.sql").write_text(ddl, encoding="utf-8")
        (dossier / "seed.sql").write_text(seed_sql(titre, tables, lundi), encoding="utf-8")
        contenu = {"meta": {"sujet": titre, "semaine_de_reference": lundi.isoformat()},
                   "tables": tables}
        (dossier / "seed.json").write_text(
            json.dumps(contenu, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (dossier / "README.md").write_text(readme(nom, titre, tables, lundi), encoding="utf-8")
        total = sum(len(r) for r in tables.values())
        print(f"✓ {nom} : {total} lignes")


if __name__ == "__main__":
    main()
