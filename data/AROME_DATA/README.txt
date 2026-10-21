POC AROME — source de données

Source de vérité (VM)
---------------------
  /mnt/partage_stomod2/AROME_DATA/<domain>/<year>/arome_YYYY-MM-DD.nc

Domaines POC (multi-niveaux)
----------------------------
  Marseille, Nice, Toulon, Fos
  (PACA exclu : grille trop lourde pour extract à la volée)

Ce dossier local (Openairmap/data/AROME_DATA) n'est plus lu par défaut.
Surcharge possible :
  AROME_DATA_ROOT=/chemin/vers/AROME_DATA
  AROME_PYTHON=/home/airpaca/prod_retarome/.venv/bin/python

Activer dans l'app
------------------
  Rail → Carte de modélisation → AROME → choisir le domaine
  Affiche t2m (raster) + vent 10 m (leaflet-velocity).
  L'heure suit la TimeBar / l'instant live.

API
---
  GET /api/arome/domains
  GET /api/arome/dates?domain=Marseille
  GET /api/arome/wind?date=YYYY-MM-DD&hour=HH&domain=Marseille
  GET /api/arome/field?var=t2m&date=YYYY-MM-DD&hour=HH&domain=Marseille
