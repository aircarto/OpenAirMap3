# Rapport comparaison AtmoMicro — ancienne API vs export microspot

Généré : 2026-10-27T10:53:37.523Z

## Décision : **GO_AVEC_RESERVE**

- Couverture jointure ≥ 90% sur PM2.5/PM10 (horaire + scan).
- Valeurs BRUTES alignées en horaire (mean≈0.05, p95≈0.1). Scan plus bruité (timestamps/délais) — attendu.
- Historique 24h (8 sites × 2 polluants) : écarts moyens < 0.1 µg/m³.
- RESERVE: écarts DISPLAY PM10 hourly (p95≈10.6) sur cluster Gardanne/Meyreuil — même raw, corrections différentes (N1/N2).
- id_site !== location_id ; jointure nom/coords. Export adresse les devices par id.
- GO service+pipeline : mapping microspot fiable ; réserve métier sur corrections PM10 affichées.

## Jointure

- **`id_site` (ancienne) ≠ `location_id` (export)** — overlap direct = 0.
- Règle : nom de site normalisé, sinon observation la plus proche **< 40 m**.
- Comparaison côté export sur le **device** joint (nouvelle capacité `device_id`).

## Dernières mesures — affichage vs brut

| Polluant | Pas | Matchés | Couverture | Écart DISPLAY mean/p95/max | Écart RAW mean/p95/max |
|---|---|---:|---:|---|---|
| PM2.5 | hourly | 113/121 | 93.4% | 0.162 / 0.6 / 3 | 0.046 / 0.1 / 0.3 |
| PM2.5 | scan | 115/123 | 93.5% | 0.348 / 1.6 / 13.8 | 0.329 / 1.6 / 13.8 |
| PM10 | hourly | 113/121 | 93.4% | 0.803 / 10.6 / 19 | 0.053 / 0.1 / 0.8 |
| PM10 | scan | 116/124 | 93.5% | 0.846 / 4 / 34.9 | 0.833 / 4.1 / 34.9 |

### Pires écarts DISPLAY PM10 hourly (raw identique)

| Site | device | old corrigé | new value_ref | old raw | new raw | diff display |
|---|---|---:|---:|---:|---:|---:|
| Gardanne_Mat'Ild | 1211D0F6 | 15.8 | 34.8 | 13.9 | 13.9 | 19 |
| Meyreuil Fauvettes | 05C1A382 | 11.4 | 25.2 | 7.6 | 7.6 | 13.8 |
| Gardanne_La_Palun | 0E1C3E25 | 10.3 | 22.7 | 10 | 10.1 | 12.4 |
| Meyreuil Malet | 7AC4C800 | 9.1 | 20.2 | 7.4 | 7.4 | 11.1 |
| Gardanne_NotreDame | DE0B8E93 | 8.9 | 19.6 | 8.4 | 8.5 | 10.7 |
| Gardanne_Arménie | 8E86600E | 8.8 | 19.4 | 7.5 | 7.6 | 10.6 |
| Meyreuil_Ecole_Robert_Lagier | AFAB4616 | 1.2 | 2.8 | 0 | 0 | 1.6 |
| Meyreuil_Mairie | C3F37C3A | 1 | 2.4 | 0 | 0 | 1.4 |

## Historique (24 h, horaire)

### PM2.5

| id_site | device_id | site | pts old | pts new | buckets | écart mean | max |
|---|---|---|---:|---:|---:|---:|---:|
| 1453 | 6730DDC7 | Lambesc_2_impasse_Jacques_Prevert_ecole | 24 | 24 | 24 | 0.054 | 0.1 |
| 1450 | BD6B1F | Carpentras | 24 | 24 | 24 | 0.042 | 0.1 |
| 1443 | BD6B97 | Camaret-sur-Aigues_D43 | 24 | 24 | 24 | 0.037 | 0.1 |
| 1439 | BD6AAD | Carpentras_104 chemin de Saint Labre | 24 | 24 | 24 | 0.042 | 0.1 |
| 1436 | BD6B2F | Aubignan_230 avenue Marcel Pagnol | 24 | 24 | 24 | 0.05 | 0.1 |
| 1415 | FAD1A756 | MIQASS_Contes_2157_D15 | 24 | 24 | 24 | 0.029 | 0.1 |
| 1401 | AIR_QAM04 | Gardanne_880_route_de_Mimet | 19 | 19 | 19 | 0.037 | 0.1 |
| 1398 | AIR_QAM01 | Gardanne_2637_route_de_Mimet | 20 | 20 | 20 | 0.04 | 0.1 |

### PM10

| id_site | device_id | site | pts old | pts new | buckets | écart mean | max |
|---|---|---|---:|---:|---:|---:|---:|
| 1456 | 4D321C89 | Nice Port Quai du Commerce | 24 | 24 | 24 | 0.037 | 0.1 |
| 1453 | 6730DDC7 | Lambesc_2_impasse_Jacques_Prevert_ecole | 24 | 24 | 24 | 0.025 | 0.1 |
| 1452 | 74CF97F4 | La Seyne Port Corniche Giovannini | 24 | 24 | 24 | 0.038 | 0.1 |
| 1450 | BD6B1F | Carpentras | 24 | 24 | 24 | 0.05 | 0.1 |
| 1444 | BD6B8A | Courthézon_51 allée des Clèdes | 24 | 24 | 24 | 0.05 | 0.1 |
| 1443 | BD6B97 | Camaret-sur-Aigues_D43 | 24 | 24 | 24 | 0.054 | 0.1 |
| 1438 | BD6B11 | Carpentras_1158 avenue des Marchés | 24 | 24 | 24 | 0.063 | 0.1 |
| 1396 | 9EDDC83D | Molo Italia_129 | 24 | 24 | 24 | 0.046 | 0.1 |

## Conclusion technique

Porter `AtmoMicroV2Service` + factory/flag sur `prod` est **justifié**.
Surveiller / arbitrer le pipeline de **correction PM10** (écart display alors que raw ≈ identique sur un cluster Gardanne/Meyreuil).
