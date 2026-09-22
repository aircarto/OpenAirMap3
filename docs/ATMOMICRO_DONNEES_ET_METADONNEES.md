# AtmoMicro — synthèse utile à OpenAirMap

Ce document liste uniquement les **données réellement utilisées** par OpenAirMap dans l’API AtmoMicro actuelle.

Source API: `https://api.atmosud.org/observations/capteurs`

---

## Routes réellement utiles

| Route | Usage OpenAirMap |
|---|---|
| `GET /sites?format=json&actifs=2880` | Catalogue des capteurs, variables disponibles, modèle, coordonnées de repli |
| `GET /mesures/dernieres?variable=...&aggregation=...&delais=...` | Carte: dernière valeur par capteur + coordonnées à jour |
| `GET /mesures/dernieres?id_site=...` | Pas de temps capteur (`pas_de_temps`) et coordonnées ponctuelles |
| `GET /mesures?id_site=...&debut=...&fin=...` | Historique d’un capteur (panneau micro/comparaison/export) |
| `GET /mesures?debut=...&fin=...&variable=...&aggregation=...` | Mode temporel (tous capteurs sur une période) |

---

## Métadonnées utiles (consommées par OpenAirMap)

### Depuis `/sites`

| Champ API | Utilisation dans OpenAirMap |
|---|---|
| `id_site` | Identifiant interne (`MeasurementDevice.id`) |
| `nom_site` | Nom affiché (marqueur, tooltip, panneau, recherche) |
| `lat`, `lon` | Coordonnées de repli (si pas de mesure récente) |
| `influence` | Construit `address` (`nom_site, influence`) |
| `code_station_commun` | Construit `departmentId` |
| `modele_capteur` | `sensorModel` (tooltip, panneau micro, export) |
| `variables` | Liste des polluants disponibles par capteur |

### Depuis `/mesures/dernieres` (ou `/mesures` en mode temporel)

| Champ API | Utilisation dans OpenAirMap |
|---|---|
| `id_site` | Jointure avec `/sites`, identité du capteur |
| `nom_site` | Nom en fallback (surtout mode temporel) |
| `lat`, `lon` | Coordonnées à jour prioritaires sur celles de `/sites` |
| `pas_de_temps` | Libellé de pas de temps réel du capteur (panneau micro) |

---

## Données utiles (mesures)

| Champ API | Utilisation dans OpenAirMap |
|---|---|
| `time` | Horodatage affiché et axe temporel |
| `valeur` | Valeur corrigée (affichage standard hors quart-horaire) — `null` en `brute`/`quart-horaire` |
| `valeur_ref` | Valeur prioritaire en `quart-horaire` |
| `valeur_brute` | Valeur brute (toggle données brutes + calcul correction) |
| `unite` | Unité affichée sur carte/graphes |

---

## Correction : disponible uniquement en horaire

L'API n'applique le modèle de correction (`coef_corr` / `biais_corr`) qu'à
l'agrégation `horaire`. En `brute` (scan, ≤ 2 min) et en `quart-horaire`,
`valeur` vaut systématiquement `null` et `valeur_ref` retombe sur
`valeur_brute` : aucune valeur corrigée n'existe côté source.

Conséquence côté app : aux pas de temps infrahoraires, `has_correction` est
toujours `false`, donc pas de pastille « valeur corrigée » sur le marqueur, pas
de série `*_corrected` dans les graphiques et colonne « (corrigé) » vide à
l'export. Ce n'est pas un défaut d'affichage.

Attention également : `valeur_brute` n'est présent que si la requête passe
`valeur_brute=true`. Les appels qui ne le demandent pas (`fetchTemporalDataOptimized`)
reçoivent une mesure sans ce champ ; la détection de correction ne doit donc
jamais s'appuyer sur sa présence.

---

## Données calculées côté OpenAirMap (non fournies telles quelles par l’API)

| Champ interne | Source/calcul |
|---|---|
| `status` | `active` si mesure récente, sinon `inactive` (fallback `/sites`) |
| `qualityLevel` | Calculé à partir des seuils polluant |
| `displayValue` | `valeur_ref` en quart-horaire, sinon `valeur` ou `valeur_brute` |
| `has_correction` | `valeur` est un nombre exploitable (l'API ne corrige qu'en agrégation `horaire`) |
| `corrected_value` | `valeur` si correction détectée |
| `raw_value` | `valeur_brute` |
| `measuredPollutants` | Dérivé de `variables` + mapping polluants |

---

## Mapping des variables AtmoMicro utilisées

| Variable API | Code OpenAirMap |
|---|---|
| `PM2.5` | `pm25` |
| `PM10` | `pm10` |
| `PM1` | `pm1` |
| `NO2` | `no2` |
| `O3` | `o3` |
| `SO2` | `so2` |

---

## Point d’attention migration

Aujourd’hui OpenAirMap consomme `id_site` comme identifiant principal.  
Dans la future API, il faudra remplacer cette clé par l’`id` capteur partout où `id_site` est utilisé.
# AtmoMicro — Données et métadonnées récupérées par OpenAirMap

**Source :** `https://api.atmosud.org/observations/capteurs`  
**Service front :** `src/services/AtmoMicroService.ts`  
**Types :** `src/types/index.ts` (`AtmoMicroSite`, `AtmoMicroMeasure`)

Ce document recense l’ensemble des champs retournés par l’API AtmoMicro actuelle, route par route, en les classant en **données** (mesures, valeurs temporelles) et **métadonnées** (informations descriptives sur le capteur, le site ou le contexte de mesure).

---

## Définitions utilisées

| Catégorie | Description | Exemples |
|-----------|-------------|----------|
| **Métadonnée** | Information descriptive, relativement stable ou contextuelle, qui identifie ou qualifie le capteur / le site sans être la mesure elle-même | nom, coordonnées, modèle, variables mesurables, campagne |
| **Donnée** | Valeur de mesure ou information directement liée à un instant ou une agrégation temporelle | concentration, horodatage, valeur brute/corrigée, unité |
| **Hybride** | Champ présent dans les réponses mesure mais de nature descriptive (répété à chaque point) | `marque_capteur`, `pas_de_temps` dans une mesure |

---

## Vue d’ensemble des routes

| # | Route | Méthode service | Contexte d’appel |
|---|-------|-----------------|------------------|
| 1 | `GET /sites?format=json&actifs=2880` | `getCachedAllSites()` | Carte, variables, cache 30 min |
| 2 | `GET /sites?format=json&download=false` | `fetchSiteCoordinates()` | Fallback coordonnées (1 site) |
| 3 | `GET /mesures/dernieres?variable=…&aggregation=…&delais=…` | `fetchMeasures()` | Carte : dernières valeurs (tous sites) |
| 4 | `GET /mesures/dernieres?id_site=…&variable=…` | `fetchSensorTimeStep()` | Panneau micro : pas de temps capteur |
| 5 | `GET /mesures/dernieres?id_site=…&variable=PM25` | `fetchSiteCoordinates()` | Panneau micro : coordonnées à jour |
| 6 | `GET /mesures?id_site=…&debut=…&fin=…&variable=…&aggregation=…` | `fetchHistoricalData()` | Courbe historique (1 site) |
| 7 | `GET /mesures?debut=…&fin=…&variable=…&aggregation=…` | `fetchTemporalDataOptimized()` | Mode historique carte (tous sites, tranches 30 j) |

> **Note :** `fetchSiteVariables()` ne fait pas d’appel API dédié : elle lit le cache issu de la route **1**.

---

## Route 1 — `GET /sites?actifs=2880`

**Rôle :** Catalogue des sites actifs (capteurs qualifiés déployés). Mis en cache côté front pendant **30 minutes**.

### Métadonnées

| Champ | Type | Description | Utilisé par OpenAirMap |
|-------|------|-------------|------------------------|
| `id_site` | `number` | Identifiant unique du site (clé primaire actuelle) | **Oui** — `MeasurementDevice.id`, requêtes `id_site=…` |
| `nom_site` | `string` | Nom du lieu / capteur | **Oui** — nom marqueur, tooltip, panneau, recherche |
| `type_site` | `string` | Type de site (ex. urbain) | Non |
| `influence` | `string` | Contexte d’exposition (ex. Résidentiel, Trafic) | **Oui** — composant de `address` |
| `lat` | `number` | Latitude (position site) | **Oui** — repli si pas de mesure récente |
| `lon` | `number` | Longitude (position site) | **Oui** — repli si pas de mesure récente |
| `code_station_commun` | `string \| null` | Code département / lien station de référence | **Oui** — mappé vers `departmentId` |
| `date_debut_site` | `string` (ISO) | Date de mise en service du site | Non |
| `date_fin_site` | `string` (ISO) | Date de fin du site | Non (filtrage implicite via `actifs=2880`) |
| `alti_mer` | `number \| null` | Altitude par rapport au niveau de la mer | Non |
| `alti_sol` | `number \| null` | Altitude par rapport au sol | Non |
| `id_campagne` | `number` | Identifiant de la campagne de déploiement | Non |
| `nom_campagne` | `string` | Nom de la campagne | Non |
| `id_capteur` | `number` | Identifiant du capteur physique | Non (prévu comme clé dans la future API) |
| `marque_capteur` | `string` | Marque du capteur (ex. Sensirion) | Non |
| `modele_capteur` | `string` | Modèle du capteur (ex. SPS30, SDS011) | **Oui** — `StationInfo.sensorModel`, tooltip, photo |
| `variables` | `string` | Liste CSV des variables (ex. `"PM10, PM2.5, Air Pres., Air Temp."`) | **Oui** — filtrage par polluant, liste polluants mesurés |

### Données

Aucune. Cette route ne retourne pas de mesure.

---

## Route 2 — `GET /sites?download=false`

**Rôle :** Fallback pour récupérer les coordonnées d’un site lorsque `/mesures/dernieres` ne renvoie rien.

Retourne le **même schéma** que la route 1. Seuls `lat` et `lon` sont exploités dans ce contexte.

---

## Route 3 — `GET /mesures/dernieres` (tous sites)

**Exemple :**
```
GET /mesures/dernieres?format=json&download=false&nb_dec=1&valeur_brute=true&type_capteur=true&variable=pm2.5&aggregation=horaire&delais=64
```

**Rôle :** Dernière mesure par site pour un polluant, une agrégation et un délai donnés. Alimente l’affichage **carte**.

### Paramètres de requête (contexte)

| Paramètre | Valeurs selon pas de temps UI |
|-----------|-------------------------------|
| `variable` | `pm2.5`, `pm10`, `pm1`, `no2`, `o3`, `so2` |
| `aggregation` | `brute` (scan), `quart-horaire` (15 min), `horaire` |
| `delais` | `181` (scan), `3` (≤2 min), `19` (15 min), `64` (heure) |
| `valeur_brute` | `true` |
| `type_capteur` | `true` |
| `nb_dec` | `1` |

### Métadonnées

| Champ | Type | Description | Utilisé par OpenAirMap |
|-------|------|-------------|------------------------|
| `id_site` | `number` | Lien vers le site | **Oui** — clé de fusion avec `/sites` |
| `nom_site` | `string` | Nom du site | **Oui** (via jointure site ; aussi présent dans la mesure) |
| `variable` | `string` | Variable mesurée (ex. `PM2.5`) | Partiel — filtrage en amont |
| `lat` | `number` | Latitude à jour | **Oui** — prioritaire sur `/sites` |
| `lon` | `number` | Longitude à jour | **Oui** — prioritaire sur `/sites` |
| `id_pas_de_temps` | `number` | Identifiant du pas de temps | Non |
| `pas_de_temps` | `number` | Intervalle d’échantillonnage (secondes) | Oui (route 4, pas route 3 carte) |
| `marque_capteur` | `string` | Marque (si `type_capteur=true`) | Non |
| `modele_capteur` | `string` | Modèle (si `type_capteur=true`) | Non — pris depuis `/sites` |
| `coef_corr` | `number \| null` | Coefficient de correction | Non |
| `biais_corr` | `number \| null` | Biais de correction | Non |
| `code_etat` | `string` | Code état / validité de la mesure | Non |

### Données

| Champ | Type | Description | Utilisé par OpenAirMap |
|-------|------|-------------|------------------------|
| `time` | `string` (ISO) | Horodatage de la mesure | **Oui** — `timestamp`, tooltip |
| `valeur` | `number \| null` | Valeur corrigée, `null` hors agrégation `horaire` | **Oui** — valeur affichée (hors quart-horaire), `corrected_value` |
| `valeur_ref` | `number \| null` | Meilleure valeur (quart-horaire) | **Oui** — valeur affichée en pas 15 min |
| `valeur_brute` | `number` (absent si `valeur_brute=false`) | Valeur brute capteur | **Oui** — `raw_value`, toggle données brutes |
| `unite` | `string` | Unité (ex. `µg/m³`) | **Oui** — affichage marqueur |

---

## Route 4 — `GET /mesures/dernieres?id_site=…` (pas de temps)

**Exemple :**
```
GET /mesures/dernieres?id_site=1175&format=json&nb_dec=0&variable=pm2.5&valeur_brute=false&type_capteur=false&detail_position=false
```

**Rôle :** Récupérer le **pas de temps réel** du capteur (panneau micro, libellé « scan »).

### Champs exploités

| Champ | Catégorie | Utilisé |
|-------|-----------|---------|
| `pas_de_temps` | Métadonnée (hybride) | **Oui** — seul champ lu |
| Autres champs | — | Ignorés dans ce contexte |

---

## Route 5 — `GET /mesures/dernieres?id_site=…` (coordonnées)

**Exemple :**
```
GET /mesures/dernieres?id_site=1175&format=json&nb_dec=0&variable=PM25&valeur_brute=false&type_capteur=false&detail_position=false
```

**Rôle :** Coordonnées les plus récentes d’un site (modélisation, panneau micro).

### Champs exploités

| Champ | Catégorie | Utilisé |
|-------|-----------|---------|
| `lat` | Métadonnée | **Oui** |
| `lon` | Métadonnée | **Oui** |
| Autres champs | — | Ignorés ; fallback route 2 si vide |

---

## Route 6 — `GET /mesures?id_site=…` (historique 1 site)

**Exemple :**
```
GET /mesures?id_site=1175&format=json&nb_dec=1&valeur_brute=true&variable=pm2.5&type_capteur=true&aggregation=horaire&debut=2025-10-08T00:00:00.000Z&fin=2025-10-09T23:59:59.999Z
```

**Rôle :** Série temporelle pour le panneau micro, la comparaison et l’export.

### Métadonnées

Mêmes champs métadonnées que la route 3 (`id_site`, `nom_site`, `variable`, `lat`, `lon`, `marque_capteur`, `modele_capteur`, `coef_corr`, `biais_corr`, `code_etat`, `pas_de_temps`, `id_pas_de_temps`).

Seuls `time` et les champs de valeur sont réellement consommés pour la courbe ; le reste est ignoré.

### Données

| Champ | Type | Utilisé par OpenAirMap |
|-------|------|------------------------|
| `time` | `string` (ISO) | **Oui** — abscisse du graphique |
| `valeur` | `number \| null` | **Oui** |
| `valeur_ref` | `number \| null` | **Oui** (quart-horaire) |
| `valeur_brute` | `number` | **Oui** |
| `unite` | `string` | **Oui** |

---

## Route 7 — `GET /mesures` (mode temporel, tous sites)

**Exemple :**
```
GET /mesures?debut=…&fin=…&format=json&nb_dec=0&variable=pm2.5&valeur_brute=false&aggregation=horaire&type_capteur=false
```

**Rôle :** Animation historique sur la carte. Période découpée en **tranches de 30 jours**.

### Métadonnées exploitées

| Champ | Utilisé |
|-------|---------|
| `id_site` | **Oui** — identification marqueur, filtrage optionnel |
| `nom_site` | **Oui** — nom du device |
| `lat`, `lon` | **Oui** — position à chaque instant |

### Données exploitées

| Champ | Utilisé |
|-------|---------|
| `time` | **Oui** — regroupement par timestamp |
| `valeur` | **Oui** |
| `valeur_ref` | **Oui** (quart-horaire) |
| `valeur_brute` | **Oui** |
| `unite` | **Oui** |

> Dans ce mode, `code_station_commun` / `departmentId` n’est pas disponible (chaîne vide côté front).

---

## Données dérivées côté OpenAirMap (non présentes dans l’API)

Ces champs sont **calculés** par `AtmoMicroService` ou d’autres modules à partir des réponses API.

| Champ interne | Catégorie | Calcul / source |
|---------------|-----------|-----------------|
| `MeasurementDevice.id` | Métadonnée | `id_site.toString()` |
| `MeasurementDevice.name` | Métadonnée | `nom_site` |
| `MeasurementDevice.address` | Métadonnée | `nom_site + ", " + influence` |
| `MeasurementDevice.departmentId` | Métadonnée | `code_station_commun` |
| `MeasurementDevice.status` | Métadonnée | `"active"` si mesure récente, sinon `"inactive"` |
| `MeasurementDevice.qualityLevel` | Donnée dérivée | Seuils polluant (`getAirQualityLevel`) |
| `has_correction` | Donnée dérivée | `valeur` est un nombre exploitable — voir « Correction : disponible uniquement en horaire » |
| `corrected_value` | Donnée | `valeur` si correction détectée |
| `raw_value` | Donnée | `valeur_brute` |
| `displayValue` | Donnée | `valeur_ref` (15 min) ou `valeur` / `valeur_brute` |
| `StationVariable.label` | Métadonnée | Constante `pollutants[code].name` |
| `StationVariable.code_iso` | Métadonnée | Texte original de `variables` (ex. `PM2.5`) |
| `StationVariable.en_service` | Métadonnée | Toujours `true` si variable listée |
| `sensorModel` | Métadonnée | `modele_capteur` |
| `measuredPollutants` | Métadonnée | Labels dérivés du parsing de `variables` |

---

## Synthèse globale par champ API

### Métadonnées — utilisées

| Champ | Route(s) source |
|-------|-----------------|
| `id_site` | `/sites`, `/mesures`, `/mesures/dernieres` |
| `nom_site` | `/sites`, `/mesures`, `/mesures/dernieres` |
| `influence` | `/sites` |
| `lat`, `lon` | `/sites`, `/mesures`, `/mesures/dernieres` |
| `code_station_commun` | `/sites` |
| `modele_capteur` | `/sites` |
| `variables` | `/sites` |
| `pas_de_temps` | `/mesures/dernieres?id_site=…` |

### Métadonnées — présentes mais non utilisées

| Champ | Route(s) source |
|-------|-----------------|
| `type_site` | `/sites` |
| `date_debut_site`, `date_fin_site` | `/sites` |
| `alti_mer`, `alti_sol` | `/sites` |
| `id_campagne`, `nom_campagne` | `/sites` |
| `id_capteur` | `/sites` |
| `marque_capteur` | `/sites`, `/mesures` (si `type_capteur=true`) |
| `id_pas_de_temps` | `/mesures`, `/mesures/dernieres` |
| `coef_corr`, `biais_corr` | `/mesures`, `/mesures/dernieres` |
| `code_etat` | `/mesures`, `/mesures/dernieres` |
| `modele_capteur` (dans mesures) | `/mesures` — ignoré au profit de `/sites` |

### Données — utilisées

| Champ | Route(s) source |
|-------|-----------------|
| `time` | `/mesures`, `/mesures/dernieres` |
| `valeur` | `/mesures`, `/mesures/dernieres` |
| `valeur_ref` | `/mesures`, `/mesures/dernieres` |
| `valeur_brute` | `/mesures`, `/mesures/dernieres` |
| `unite` | `/mesures`, `/mesures/dernieres` |

---

## Où les informations apparaissent dans l’interface

| Zone UI | Métadonnées | Données |
|---------|-------------|---------|
| Marqueur carte | nom, coords, statut actif/inactif | valeur, unité, niveau qualité, correction |
| Tooltip | nom, modèle, polluants mesurés | dernière MAJ (`time`) |
| Recherche | nom, source | valeur, badge correction |
| Panneau micro | nom, modèle, polluants, pas de temps scan | courbes historiques brute/corrigée |
| Mode comparaison | nom, adresse | séries historiques |
| Export PDF | nom, modèle, pas de temps | séries historiques |
| Encart « Informations » | — (placeholder, non alimenté) | — |

---

## Polluants et variables reconnus

Mapping API → codes OpenAirMap (`ATMOMICRO_POLLUTANT_MAPPING`) :

| Variable API | Code OpenAirMap |
|--------------|-----------------|
| `PM2.5` | `pm25` |
| `PM10` | `pm10` |
| `PM1` | `pm1` |
| `NO2` | `no2` |
| `O3` | `o3` |
| `SO2` | `so2` |

Variables présentes dans `variables` mais **ignorées** par le front : `Air Pres.`, `Air Temp.`, `Air Hum.`, etc.

---

## Évolution prévue (nouvelle API)

D’après les travaux en cours :

- **`id_site` disparaît** — l’identifiant principal devient l’**`id` capteur** (`id_capteur` dans l’API actuelle).
- Objectif : réduire le nombre de routes et fusionner métadonnées + dernière mesure par capteur.

Voir aussi : `docs/API_ATMOMICRO_OPTIMISATION_REQUETES.md`.

---

*Document généré à partir de l’analyse du code OpenAirMap — juin 2025.*
