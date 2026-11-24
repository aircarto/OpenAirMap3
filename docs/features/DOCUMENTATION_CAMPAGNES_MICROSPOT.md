# Documentation Technique - Extraction de campagnes microcapteurs (microspot)

**Version** : 1.1 (entrée par localisation)
**Date** : 24 novembre 2026
**Branche** : `feat/campagnes-microspot` (issue de `feat/auth`)
**Auteur** : Équipe ReactOpenAirMap

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Accès et authentification](#accès-et-authentification)
4. [API microspot utilisée](#api-microspot-utilisée)
5. [Période préremplie](#période-préremplie)
6. [Localisations](#localisations)
7. [Moteur d'extraction](#moteur-dextraction)
8. [Stockage des mesures](#stockage-des-mesures)
9. [Export CSV](#export-csv)
10. [Interface](#interface)
11. [Tests](#tests)
12. [Limites connues](#limites-connues)
13. [Guide de maintenance](#guide-de-maintenance)
14. [Dépannage](#dépannage)

---

## Vue d'ensemble

### Objectif

La page `/[locale]/campagnes` permet aux ingénieurs connectés (Keycloak) de récupérer **toutes les
mesures horaires d'une campagne de microcapteurs**, sur des périodes longues (12 mois et plus).
L'entrée se fait **par localisation** (le lieu de mesure), sur la carte comme dans la liste. Le
graphique superpose une courbe par localisation et par capteur, et l'export est un CSV au format long.

### Principes

- **API microspot uniquement**, indépendamment du flag `NEXT_PUBLIC_USE_MICROSPOT_API` (qui ne
  concerne que la carte publique).
- **Horaire uniquement, sans agrégation de substitution.** On ne passe jamais en journalier pour
  alléger : on multiplie les requêtes à la place.
- **Jamais de troncature silencieuse.** Une réponse tronquée par l'API est redemandée en deux moitiés.
- **Tout se fait dans le navigateur** : pas de backend intermédiaire, requêtes découpées et
  parallélisées, barre de progression.

### Parcours utilisateur

1. Choisir une étude (filtre facultatif), puis une campagne.
2. Choisir un ou plusieurs polluants (PM2.5 et PM10 par défaut).
3. Ajuster si besoin la période, préremplie d'après la campagne.
4. Décocher les localisations à ne pas extraire (toutes sont cochées par défaut), dans la liste ou
   par un clic sur la carte.
5. **Charger** : extraction horaire des capteurs, sur leurs périodes de présence aux localisations
   cochées.
6. Explorer : cocher les localisations à afficher, déplier une localisation pour masquer un de ses
   capteurs, survoler pour mettre en évidence.
7. **Exporter CSV**.

---

## Architecture

```
app/[locale]/campagnes/page.tsx              Server component : metadata (noindex), rend l'entrée client
└─ components/campaigns/CampaignsAppEntry    <AuthProvider> + gate chargé en ssr:false
   └─ CampaignsGate                          Keycloak désactivé / chargement / écran de connexion
      └─ CampaignsPage                       Sélection, période, chargement, export, liste des capteurs
         ├─ useCampaignExtraction            État React de l'extraction (progression, échecs, export)
         ├─ CampaignSiteList                 Liste des localisations (extraire / afficher / capteurs)
         ├─ CampaignMap   (ssr:false)        react-leaflet, une localisation par marqueur
         └─ CampaignChart (ssr:false)        amCharts 5, une courbe par localisation × capteur

services/microspot/                          Sans React, testé unitairement
├─ MicrospotCampaignClient.ts                fetch + Bearer, lecture de X-Truncated, erreurs typées
├─ campaignPeriod.ts                         resolveCampaignPeriod() : période préremplie
├─ campaignLocalisations.ts                  Localisations (fusion à 10 m), rattachement des mesures
├─ campaignExtraction.ts                     buildExtractionTargets(), planChunks(), runExtraction()
├─ campaignDataStore.ts                      Store colonnaire (tableaux typés) par capteur × variable
└─ campaignCsv.ts                            CSV long, généré par parts

services/geocoding/banReverse.ts             Géocodage inverse BAN (Géoplateforme IGN), avec cache
```

Fichiers existants modifiés :

| Fichier | Modification |
|---|---|
| `src/types/index.ts` | Types `MicrospotStudy`, `MicrospotCampaignListItem`, `MicrospotCampaignDevice`, `MicrospotDeviceWithLocationHistory`, `MicrospotStatusCode` ; `status_code` sur `MicrospotObservation` |
| `src/services/AtmoMicroV2Service.ts` | `VARIABLE_ISO_CODES` exporté |
| `src/i18n/routing.ts` | Route `'/campagnes'` déclarée (pathnames typés de next-intl) |
| `src/components/map/rail/sections/RailFooter.tsx`, `railIcons.tsx` | Entrée « Camp. » du rail, visible seulement une fois connecté |
| `src/locales/*.json` | Clés `campaigns.*`, `pages.campaigns.*`, `rail.campaigns*` |

---

## Accès et authentification

- **Garde** (`CampaignsGate.tsx`), à partir de `useAuth()` :
  - `enabled === false` (Keycloak non configuré) : message « indisponible ».
  - `ready === false` : écran de chargement.
  - non authentifié : écran de connexion (`data-testid="campaigns-login-required"`), bouton
    `login()`. Le retour après Keycloak ramène sur `/campagnes` grâce au `state.returnTo` déjà géré
    par `AuthContext.login`.
- **Rail** : l'item `rail-campaigns-link` n'est rendu que si `isAuthenticated`, et navigue par
  `router.push("/campagnes")` (`useRouter` de `src/i18n/navigation`).
- **SEO** : `robots: { index: false, follow: false }` ; la page n'est pas listée dans
  `app/sitemap.xml/route.ts`.
- **Jeton** : le client relit `getAccessToken()` **à chaque requête**, pour qu'une extraction de
  plusieurs minutes profite du renouvellement silencieux du jeton.
- **Pas de repli public** : un 401 lève `MicrospotAuthError`, qui interrompt toute l'extraction
  (`state.authError = true`). Sans le Bearer, on perdrait les campagnes non exposées et les mesures
  invalidées, ce qui fausserait l'export.

> **Piège SSR** : tout composant qui appelle `useTranslation()` (react-i18next) doit être chargé en
> `dynamic(..., { ssr: false })`. i18next n'est initialisé que dans le navigateur ; rendu côté
> serveur, `useTranslation` suspend sans fin et la requête HTTP ne répond jamais (pas d'erreur dans
> les logs). C'est pourquoi seul `AuthProvider` est rendu côté serveur dans `CampaignsAppEntry`.

---

## API microspot utilisée

Référence : `uspot-api-export/docs/api-routes.md`. Base URL : `getMicrospotApiBaseUrl()`.

| Méthode du client | Route | Remarques |
|---|---|---|
| `listCampaigns()` | `GET /lists/campaigns?list_devices=true&include_non_exposed=true` | `devices[] {id, start_date, end_date}` ; `study_id` présent seulement avec un Bearer |
| `listStudies()` | `GET /lists/studies?include_non_exposed=true` | Bearer requis ; en cas d'échec, le filtre étude est simplement masqué |
| `listDeviceLocationHistories()` | `GET /lists/devices?locations_history=true&include_non_exposed=true` | Historique des positions de chaque capteur : base des [localisations](#localisations) |
| `listStatusCodes()` | `GET /lists/observations/status_code` | Bearer requis ; sert à la colonne `status_label` |
| `fetchObservationsChunk()` | `GET /observations` | Voir ci-dessous |

Paramètres envoyés à `/observations` :

```
aggregation=hourly
campaign_id=<id>            device_id=<id>          variable=39,24,…   (codes ISO)
from_date_time=<ISO UTC>    date_time=<ISO UTC>
include=raw_value,corrections_detail,manually_validated,device_model
decimals=2                  limit=500000
invalid=true                include_non_exposed=true
```

Pas de `gapfill` : on exporte les mesures réelles, les trous restent des trous.

Comportements de l'API pris en compte :

- **Résultat vide** : `204` sans corps, traité comme `[]` (un corps vide aussi).
- **Plafond d'environ 12 MiB par réponse**, sans pagination : l'API coupe et pose
  `X-Truncated: true`. Cet en-tête est exposé en CORS (vérifié le 2026-11-19). Par sécurité, une
  réponse de `limit` lignes est aussi considérée comme tronquée.
- **Erreurs transitoires** : `429`, `502`, `503`, `504` (`MicrospotHttpError.retryable`) et erreurs
  réseau (`TypeError` levé par `fetch`) sont relancées.
- Dans `locations_history[]`, le champ `campaign` est un **nom** de campagne et non un identifiant,
  et il n'y a **pas de `location_id`** ; `lat`/`lon` sont des chaînes. Le rattachement à la campagne
  compare des noms normalisés (minuscules, sans accents ni ponctuation).
- `/lists/locations` n'est **pas** utilisée : elle ne liste pas les sites générés pour les capteurs
  citoyens (comportement 9 de l'API).

Codes ISO (`VARIABLE_ISO_CODES`) : pm25 `39`, pm10 `24`, pm1 `68`, no2 `03`, o3 `08`, so2 `01`.

---

## Période préremplie

`resolveCampaignPeriod(campaign, now)` (`campaignPeriod.ts`) est une fonction pure. Elle ne fait que
**préremplir** les champs : l'utilisateur peut saisir n'importe quelle période, bornée seulement par
aujourd'hui.

| | Règle | `source` |
|---|---|---|
| **Début** | `campaign.start_date` si renseignée | `campaign` |
| | sinon le `devices[].start_date` le plus ancien | `oldestDevice` |
| | sinon vide, saisie manuelle | `none` |
| **Fin** | `campaign.end_date` si renseignée | `campaign` |
| | sinon le `devices[].end_date` le plus récent, **si tous les capteurs sont clos** | `lastDevice` |
| | sinon maintenant | `today` |
| | dans tous les cas, plafonnée à maintenant | `today` |

L'origine de chaque date est affichée sous le champ (`campaigns.periodSource.*`).

`earlierDeviceStart` signale un capteur qui a démarré **avant** le début retenu. L'UI affiche alors
un message non bloquant et un bouton « Étendre la période ». Exemple réel : la campagne #48 démarre le
2026-09-15 alors que ses capteurs mesurent depuis le 2023-01-11.

Relevé du 2026-11-19 sur les 22 campagnes exposées : 9 sans `start_date`, 19 sans `end_date`, et 2
`end_date` prévisionnelles en 2027. D'où les replis ci-dessus.

**Conversion des dates saisies** (`CampaignsPage`) : les `<input type="date">` sont en heure locale.
`from` = minuit local du jour de début ; `to` = minuit local du **lendemain** du jour de fin (borne
exclusive), plafonné à `Date.now()`.

---

## Localisations

`campaignLocalisations.ts`, fonctions pures.

### Pourquoi pas simplement `location_id`

Une partie de la flotte est opérée par des **citoyens** (surveillance participative : Capt'Air
Citoyen, FNE13/CAN…). Leurs déplacements sont **déclaratifs**, et chaque déclaration crée un nouveau
site, avec un `location_id` du type `<capteur>_<uuid>` et le nom `auto created for device <id interne>`,
même quand la position ne bouge que de quelques mètres. Exemple réel, Neb-139 (relevé du 2026-11-20) :
quatre identifiants de site, dont trois au même endroit à 2 m près, des déclarations de 21 s ou 47 s,
et des périodes sans site. Regrouper par `location_id` fragmenterait ce capteur en lieux identiques.

### Construction : `buildCampaignLocalisations(campaign, histories)`

Entrées retenues : capteurs de la campagne, entrées d'historique dont la campagne a le même nom
normalisé.

| Sorte | Origine | Clé | Regroupement |
|---|---|---|---|
| `named` | site nommé (opéré par AtmoSud) | `named:<nom normalisé>` | partagé entre tous les capteurs du site |
| `declared` | site `auto created for device …` | `declared:<capteur>:<n>` | déclarations **d'un même capteur** à **≤ 10 m** les unes des autres (union-find, haversine) ; pas de fusion entre capteurs |
| `undeclared` | entrée sans site, ou capteur sans historique | `undeclared:<capteur>` | toutes les périodes sans site du capteur ; capteur sans historique : sa période sur la campagne |

Le seuil `MERGE_DISTANCE_M = 10` correspond au choix « 100 m² » (carré de 10 m de côté). Pour mémoire,
la directive 2008/50/CE (annexe III, B) parle d'un tronçon de rue **d'au moins 100 m** pour un site
trafic ; la directive 2004/107/CE donnait 200 m² comme ligne directrice. Aucun texte ne fixe de
rayon de fusion.

Ordre d'affichage : sites nommés (alphabétique), positions déclarées (par capteur puis date),
périodes sans site.

Ordres de grandeur sur les données publiques du 2026-11-20 : GPMM, 19 capteurs → 13 sites nommés ;
Capt'Air Citoyen, 76 capteurs et 331 entrées d'historique → 175 positions déclarées et 75 périodes
sans site.

### Rattachement des mesures : `assignStoreToLocalisations(store, localisations)`

Chaque ligne reçue est rattachée à une localisation par `LocalisationResolver`, dans cet ordre :

1. pas de site → `undeclared:<capteur>` ;
2. site nommé → `named:<nom>` ;
3. site déclaré → la localisation du capteur dont un point est à ≤ 10 m ;
4. à défaut, celle dont la période de présence contient l'heure ;
5. à défaut, une localisation **découverte** (`discovered`), ajoutée à la liste et à la carte (marqueur
   en pointillés).

Le résultat est mémoïsé par (capteur, site de la ligne). Il fournit, pour chaque série du store, la
clé de localisation de chaque ligne (`rowKeys`, utilisée par le CSV) et les index de lignes par
localisation (`parts`, utilisés par le graphique).

### Noms affichés et géocodage BAN

| Sorte | Libellé |
|---|---|
| `named` | nom du site |
| `declared` | « Capteur · adresse » ; à défaut « Capteur · lat, lon » |
| `undeclared` | « Capteur · position non déclarée » |

L'adresse vient de l'API Adresse (BAN), opérée par l'IGN sur la Géoplateforme depuis le transfert
de `api-adresse.data.gouv.fr` : `GET https://data.geopf.fr/geocodage/reverse?lon=…&lat=…&index=address&limit=1`
(`banReverse.ts`). Cet appel est fait sans clé, depuis le navigateur (CORS ouvert), avec une limite de
50 requêtes/s par IP.

- Appel seulement pour les localisations `declared`, et seulement en France métropolitaine et en
  Corse (bbox) : hors de France (ex. Livourne), on garde les coordonnées.
- Adresse écartée si elle est à plus de 200 m (`MAX_ADDRESS_DISTANCE_M`).
- 4 requêtes simultanées au plus, cache en mémoire par position (5 décimales). Une erreur réseau
  n'est pas mise en cache.
- **Confidentialité** : ces positions sont souvent des domiciles de particuliers. Elles sont envoyées
  à l'IGN pour l'affichage aux seuls utilisateurs connectés ; ne pas réutiliser ce service ailleurs
  sans le même cadre.

---

## Moteur d'extraction

`campaignExtraction.ts`, indépendant de React.

### Cibles : `buildExtractionTargets(devices, localisations, cochées)`

Une cible = un capteur et ses périodes à interroger :

- **toutes** les localisations du capteur sont cochées → sa période sur la campagne
  (`devices[].start_date / end_date`), d'un seul tenant : les trous entre déclarations ne font rien
  perdre ;
- **une partie** seulement → l'union de ses présences sur les localisations cochées ;
- **aucune** → pas de requête.

Pas de filtre `location_id` dans la requête : les sites déclarés n'ont pas d'identifiant connu avant
le chargement. C'est le rattachement des mesures qui répartit ensuite les lignes.

### Découpage : `planChunks(request)`

- **Une requête = un capteur × une fenêtre de temps × toutes les variables choisies.**
- Chaque période est intersectée avec la période demandée, puis alignée sur l'heure : début à
  l'heure inférieure, fin à l'heure supérieure (une déclaration de 47 s garde son bucket horaire).
  Les périodes qui se touchent sont fusionnées. Une borne absente est remplacée par la borne demandée.
- Taille de fenêtre : `windowDaysFor(n) = max(1, floor(15000 / (n × 24)))` jours, soit environ
  15 000 lignes par réponse (`TARGET_ROWS_PER_REQUEST`). Une ligne avec tous les `include` pèse
  environ 380 octets : environ 5,7 Mo par réponse, la moitié du plafond.

| Polluants | Fenêtre | Campagne de 12 mois, 20 capteurs |
|---|---|---|
| 1 | 625 jours | 20 requêtes |
| 2 | 312 jours | 40 requêtes |
| 3 | 208 jours | 40 requêtes |
| 6 | 104 jours | 80 requêtes |

Le nombre de requêtes prévu s'affiche sur le bouton **Charger**.

### Exécution : `runExtraction(request, chunks, options)`

- **Pool de workers** : `DEFAULT_CONCURRENCY = 6` requêtes en parallèle, qui consomment une file
  commune.
- **Troncature** : la fenêtre est coupée en deux à l'heure près (`splitChunk`) et chaque moitié est
  retraitée récursivement, dans le même worker ; `total` augmente de 1 à chaque coupe. Sous une
  heure, la tranche passe en échec plutôt que d'être acceptée tronquée.
- **Relances** : `MAX_ATTEMPTS = 3`, backoff exponentiel de 1 s puis 2 s, seulement sur les erreurs
  relançables.
- **Erreur d'auth** : fatale. Les workers s'arrêtent et l'erreur est relevée à la fin.
- **Annulation** : `AbortSignal`, propagé jusqu'au `fetch`. Le résultat porte `aborted: true` et
  garde ce qui a déjà été reçu.
- **Échecs définitifs** : listés dans `failures[]` (tranche + message). Ils n'interrompent pas les
  autres tranches.
- **Reprise** : `options.store` permet d'ajouter au store existant. C'est ainsi que
  `retryFailures()` ne relance que les tranches en échec.
- Retour : `{ store, failures, aborted, requests }`.

Injection pour les tests : `client`, `sleep`, `concurrency`.

### Hook React : `useCampaignExtraction()`

- Expose `{ state, store, exporting, start, cancel, reset, retryFailures, exportCsv }`.
- `state.status` : `idle | running | done | aborted | error`.
- La progression est limitée à une mise à jour toutes les 200 ms (`PROGRESS_THROTTLE_MS`), pour ne
  pas re-rendre la page à chaque réponse.
- `state.version` est incrémenté quand le store change. Le store étant muté hors de React, c'est ce
  compteur qui déclenche le recalcul des `useMemo` (sites, séries du graphique, compteurs).
- Une nouvelle extraction annule la précédente ; un résultat qui arrive après coup est ignoré.
- Changer de campagne appelle `reset()`.

---

## Stockage des mesures

`CampaignDataStore` (`campaignDataStore.ts`).

Une campagne de 12 mois et plus représente un million de lignes et au-delà. Gardées en objets JSON,
elles coûteraient environ 1 Ko par ligne. Le store range donc chaque **série (capteur × variable)**
en colonnes :

| Colonne | Type | Encodage |
|---|---|---|
| `time` | `Float64Array` | epoch ms, trié, sans doublon |
| `valueRef`, `value`, `valueRaw`, `valueN1` | `Float64Array` | `NaN` = null |
| `isN1`, `isN2`, `manuallyValidated` | `Int8Array` | `-1` null, `0` faux, `1` vrai |
| `statusCode` | `(string \| null)[]` | |
| `locationIndex` | `Uint32Array` | index dans `store.locations` (site, lat/lon dédupliqués) |

- `addRows()` accumule dans des tableaux JS (`SeriesBuilder`) ; `getSeries()` finalise au premier
  appel : tri par temps, **dédoublonnage par horodatage** (les fenêtres adjacentes et les reprises
  peuvent se recouvrir), conversion en tableaux typés. Le résultat est mis en cache jusqu'au prochain
  `addRows()`.
- Clé de série : `seriesKey(deviceId, iso) = "deviceId|iso"`.
- `rowCount` = lignes reçues ; `finalizedRowCount` = lignes après dédoublonnage (= lignes du CSV).
- La clé ne contient pas la localisation : un capteur qui déménage reste une seule série, ce qui
  garde le CSV chronologique par capteur. Le découpage par localisation se fait à la lecture (voir
  [Rattachement des mesures](#rattachement-des-mesures--assignstoretolocalisationsstore-localisations)).

---

## Export CSV

`campaignCsv.ts`.

### Format

- **Format long** : une ligne par capteur × variable × heure, triée par capteur, puis variable, puis
  heure.
- Séparateur **virgule**, point décimal, BOM UTF-8, fin de ligne `\n` : comme `exportDataAsCSV`
  (`src/utils/exportUtils.ts`) et le défaut de `read_csv` (R, pandas).
- **Pas d'en-tête de métadonnées** : le fichier reste lisible tel quel. Le contexte est dans les
  colonnes et dans le nom du fichier.
- Échappement : guillemets si la valeur contient `"`, `,`, `;` ou un saut de ligne.

### Colonnes

| Colonne | Contenu |
|---|---|
| `time_utc` | ISO 8601 UTC, ex. `2026-08-11T07:00:00Z` (début du bucket horaire) |
| `time_local` | Heure de Paris avec décalage, ex. `2026-08-11T09:00:00+02:00` (gère le changement d'heure) |
| `study_id`, `study_name` | Étude de la campagne (vide si `/lists/studies` est indisponible) |
| `campaign_id`, `campaign_name` | |
| `device_id`, `device_name`, `brand`, `model` | Nom : celui de l'API, sinon celui de l'historique des positions (`/lists/devices`) |
| `location_id`, `location_name`, `lat`, `lon` | Site brut de l'API **à cette heure-là** (un capteur peut déménager) |
| `site_key`, `site_label` | Localisation de la page (après fusion à 10 m) et son libellé affiché (adresse BAN, nom du site…) |
| `variable_iso_code`, `variable_name`, `unit` | |
| `value_ref` | Valeur de référence (celle affichée sur le graphique) |
| `value`, `value_raw`, `value_n1` | Valeur corrigée, brute, après correction N1 |
| `is_n1_applied`, `is_n2_applied`, `manually_validated` | `true` / `false` / vide |
| `status_code`, `status_label` | Code d'état et son libellé (`/lists/observations/status_code`) |

### Génération

`buildCampaignCsvBlob()` écrit le fichier par parts de 20 000 lignes et rend la main à l'UI entre
deux parts (`setTimeout(0)`), avec un callback de progression. Le `Blob` final est enregistré via
`saveAs` (file-saver).

Nom de fichier : `campagne_{id}_{slug-du-nom}_{debut}_{fin}_horaire.csv`, avec des dates **locales**.
La fin est le dernier jour inclus (`to - 1 ms`, puisque `to` est exclusif), par exemple
`campagne_71_gpmm_2026-08-01_2026-08-21_horaire.csv`.

---

## Interface

### Barre latérale (`CampaignsPage`, `CampaignSiteList`)

| Élément | `data-testid` | Comportement |
|---|---|---|
| Filtre étude | `campaigns-study-select` | Affiché seulement si des études ont été chargées |
| Recherche + liste des campagnes | `campaigns-list` | Tri par date de début décroissante |
| Polluants | | Cases à cocher, pm1, pm25, pm10, no2, o3, so2 |
| Période | `campaigns-from`, `campaigns-to` | Préremplie, origine affichée, bornée à aujourd'hui |
| Charger | `campaigns-load` | Affiche le nombre de requêtes prévu |
| Progression | | Requêtes faites / total, lignes reçues, bouton Annuler |
| Échecs | | Liste des tranches en échec, bouton Relancer |
| Exporter CSV | `campaigns-export` | Actif dès que des données sont chargées |
| Localisations | `campaigns-sites`, `campaigns-site` (`data-site-key`), `campaigns-site-checkbox` | Avant chargement : case « extraire » (toutes cochées). Après : case « afficher ». Dépliable : capteurs du site, avec leur période, et après chargement une case par capteur pour le masquer |

### Carte (`CampaignMap`)

- Un marqueur par localisation ayant une position (centre des déclarations fusionnées). Les
  périodes sans site n'y figurent pas.
- Localisation non cochée pour l'extraction : grisée. Localisation découverte : contour en pointillés.
- **Clic** : avant chargement, coche ou décoche l'extraction ; après, affiche ou masque la
  localisation. **Survol** : affiche temporairement ses courbes, en trait épaissi.
- La vue se recadre sur les localisations (`FitToSites`).

### Graphique (`CampaignChart`)

- amCharts 5, axe de dates à `baseInterval` horaire, affiché en heure locale du navigateur.
- Un polluant à la fois (sélecteur), une `LineSeries` par **localisation × capteur** affichée ou
  survolée, tracée sur `value_ref`. Couleur par localisation ; dans une localisation à plusieurs
  capteurs, le deuxième et les suivants sont en pointillé. Libellé « Localisation · Capteur ».
- Un capteur qui déménage contribue à chacune de ses localisations : sa courbe change de couleur au
  déménagement.
- **Points horaires complets, aucune agrégation.** Chaque série porte ses propres données (pas de
  tableau fusionné par horodatage). `connect: false` et `autoGapCount: 1.5` coupent la ligne dès
  qu'il manque une heure.
- Les séries sont synchronisées de façon incrémentale (ajout, retrait, mise en évidence) sans
  recréer le graphique. Légende, scrollbar et curseur de zoom sont inclus.
- Le graphique s'affiche **à la fin du chargement**, pas au fil de l'eau.
- Affichage automatique de toutes les localisations ayant des données si cela fait 8 courbes ou
  moins (`AUTO_SELECT_MAX`).

### Traductions

Clés `campaigns.*` dans `src/locales/*.json` : le français est complet, les autres langues reprennent
pour l'instant le texte anglais. Les metadata de la page passent par next-intl (`pages.campaigns`).

---

## Tests

### Unitaires (vitest) : `src/services/microspot/__tests__/`

| Fichier | Couvre |
|---|---|
| `campaignPeriod.test.ts` | Toutes les combinaisons de dates, fin future plafonnée, cas #48 (fixtures issues du relevé réel) |
| `campaignLocalisations.test.ts` | Historique réel de Neb-139 : fusion à 10 m, entrées d'une autre campagne ignorées, site nommé partagé, périodes sans site, ordre ; rattachement par nom, proximité et localisation découverte ; capteur qui déménage réparti entre ses localisations |
| `geocoding/__tests__/banReverse.test.ts` | Format de l'adresse, distance maximale, pas d'appel hors de France, cache, erreur réseau non mise en cache |
| `campaignExtraction.test.ts` | Cibles selon les localisations cochées, fusion des périodes et bucket d'une déclaration courte, taille des fenêtres, intersection avec les périodes des capteurs, bisection sur troncature, relances 504, échec définitif, erreur d'auth fatale, annulation (la reprise via `retryFailures` n'est pas testée) |
| `campaignCsv.test.ts` | Colonnes (dont `site_key`, `site_label`), BOM, échappement, heure locale été/hiver, dédoublonnage, nom de fichier |
| `MicrospotCampaignClient.test.ts` | 204 → `[]`, Bearer relu à chaque appel, 401 → `MicrospotAuthError`, paramètres de `/observations` et de `/lists/devices`, lecture de `X-Truncated` |

Les Blobs sont lus via `FileReader` : jsdom n'implémente pas `Blob.arrayBuffer()`.

```bash
npx vitest run src/services/microspot src/services/geocoding
```

### End-to-end (Playwright) : `e2e/campaigns.spec.ts`

1. **Sans session** : `/en/campagnes` affiche l'écran de connexion, et le rail de `/en` n'a pas
   d'item Campagnes.
2. **Session simulée** : une session OIDC factice est injectée dans `sessionStorage` (clé
   `oidc.user:<authority>:<client_id>`) ; `**/microspot/**` et le géocodage BAN sont mockés. Le
   test filtre l'étude, choisit la campagne, vérifie les deux localisations (site nommé, position
   déclarée avec son adresse) et les dates préremplies, charge, vérifie que chaque requête porte
   `Bearer fake-access-token`, télécharge le CSV et contrôle son nom, son en-tête, son nombre de
   lignes et la répartition d'un capteur qui déménage entre `site_key`.
3. **Localisation décochée** : seule la présence restante est demandée (un capteur, une période).

Rappel : Playwright rend l'app en **anglais**, et les specs doivent amorcer le tour guidé
(`seedToursCompleted`).

---

## Limites connues

- **Pas encore validé contre l'API réelle avec un vrai compte.** La forme des réponses réservées aux
  connectés (`/lists/studies`, `study_id`, `/lists/observations/status_code`) suit la documentation
  de l'API, pas une réponse observée. Le test manuel sur une campagne de plus de 12 mois reste à
  faire.
- **Tout est en mémoire.** Le store est compact, mais le CSV est assemblé en `Blob` de chaînes
  avant d'être enregistré. Au-delà de quelques millions de lignes, l'onglet peut saturer. Le
  streaming vers un fichier (File System Access API) serait la suite logique si besoin.
- **Bisection séquentielle** : les deux moitiés d'une tranche tronquée sont traitées par le même
  worker, l'une après l'autre. Ce cas devrait rester rare avec la taille de fenêtre choisie.
- Le nombre de requêtes annoncé sur **Charger** ne compte pas les coupes dues à une troncature.
- Le graphique n'est pas progressif : il apparaît une fois l'extraction terminée.
- **Campagnes citoyennes : listes longues.** Même fusionnées à 10 m, les déclarations donnent environ
  2 à 3 localisations par capteur (Capt'Air Citoyen : 250 entrées), dont des positions de quelques
  minutes sans aucune donnée horaire. Après chargement, elles apparaissent « aucune donnée » et
  restent inactives.
- Les dates de présence des capteurs citoyens sont déclaratives. L'extraction d'une **partie** des
  localisations s'appuie sur elles ; quand toutes sont cochées, on prend la période de campagne du
  capteur et rien ne dépend de ces dates.
- **Codes d'état N / R trompeurs** (vérifié en base Spot le 2026-11-24, campagne #134) : `N`
  (« Null ») porte souvent une valeur (trust moyen ~27 %), `R` (« Reconstructed ») est toujours vide.
  Ce n'est ni l'API export ni la page : la base remplit ainsi. Pour qualifier une mesure dans le CSV,
  s'appuyer sur la présence de `value_ref`, pas sur `status_code` seul.
- Traductions non françaises provisoires (texte anglais).

---

## Guide de maintenance

| Je veux… | Où intervenir |
|---|---|
| Ajouter un polluant | `VARIABLE_ISO_CODES` (`AtmoMicroV2Service.ts`) et `CAMPAIGN_POLLUTANTS` (`CampaignsPage.tsx`) |
| Ajuster la charge sur l'API | `DEFAULT_CONCURRENCY`, `TARGET_ROWS_PER_REQUEST` (`campaignExtraction.ts`) |
| Changer le rayon de fusion des déclarations | `MERGE_DISTANCE_M` (`campaignLocalisations.ts`) et son test |
| Changer le nommage des localisations | `siteLabel` (`CampaignsPage.tsx`), `formatBanAddress` (`banReverse.ts`) |
| Ajouter une colonne au CSV | `CAMPAIGN_CSV_COLUMNS` et la ligne dans `buildCampaignCsvBlob` ; si la donnée vient de l'API, l'ajouter au store (`SeriesBuilder` + `FinalizedSeries`) et à `OBSERVATION_INCLUDES` si un `include` est nécessaire |
| Changer les règles de période | `resolveCampaignPeriod` + `campaignPeriod.test.ts` |
| Changer le seuil d'affichage auto | `AUTO_SELECT_MAX` (`CampaignsPage.tsx`) |
| Modifier les textes | `campaigns.*` dans `src/locales/*.json` |

Règles à préserver :

- Ne jamais introduire d'agrégation ni de `gapfill` « pour alléger ».
- Ne jamais accepter une réponse avec `X-Truncated: true`.
- Ne pas ajouter de repli public sur 401.
- Garder `useTranslation` hors du rendu serveur (`ssr: false`).
- Garder la page hors du sitemap et en `noindex`.

---

## Dépannage

| Symptôme | Cause probable |
|---|---|
| La page ne répond jamais en dev ou en e2e (`net::ERR_ABORTED` sur `page.goto`), sans erreur dans les logs | Un composant utilisant `useTranslation` est rendu côté serveur : le charger en `ssr: false` |
| « Session expirée » pendant une extraction | 401 → `MicrospotAuthError`. Vérifier le renouvellement silencieux Keycloak ; se reconnecter, puis relancer |
| Filtre étude absent | `/lists/studies` a échoué ou renvoyé une liste vide (rôle Keycloak, jeton) |
| `status_label` vide | `/lists/observations/status_code` indisponible, ou code absent du référentiel |
| Localisation absente de la carte | Période sans site déclaré (pas de position), ou site nommé sans coordonnées |
| « Capteur · 43.34746, 5.46972 » au lieu d'une adresse | Hors de France, adresse à plus de 200 m, ou Géoplateforme injoignable (nouvel essai au prochain rendu) |
| Un même lieu apparaît deux fois pour un capteur citoyen | Déclarations à plus de 10 m l'une de l'autre : comportement voulu (`MERGE_DISTANCE_M`) |
| Tranches en échec répétées en 504 | Requêtes trop lourdes côté base : baisser `TARGET_ROWS_PER_REQUEST` ou la concurrence |
| Dates du nom de fichier décalées d'un jour | Les dates doivent être formatées en local, pas en UTC (`localDay` dans `campaignCsv.ts`) |
