# Feature PoC — Source Météo-France (Observations DPObs)

Résumé du travail réalisé sur la branche `feat/meteo` pour intégrer l’API **Données d’observation** (DPObs) de Météo-France comme source cartographique complémentaire à la qualité de l’air.

Références :

- [API Ciblée Données d’Observation (Confluence)](https://confluence-meteofrance.atlassian.net/wiki/spaces/OpenDataMeteoFrance/pages/853639294/API+Cibl+e+Donn+es+d+Observation)
- Portail : [DonneesPubliquesObservation](https://portail-api.meteofrance.fr/web/fr/api/DonneesPubliquesObservation)

---

## Objectif

Afficher sur la carte OpenAirMap des mesures météo temps réel (stations terrestres + bouées), activables comme une source classique, en respectant les temporalités de l’app (**Scan** / **Heure**), avec un menu **Variables** permettant de choisir **1 polluant + 1 variable météo** en parallèle.

---

## Décisions produit / technique

| Sujet | Choix V1 / PoC |
|--------|----------------|
| Source | `meteoFrance`, désactivée par défaut, case unique (stations + bouées) |
| Paramètres (priorité) | Vent → température → humidité → précipitations |
| Temporalités | `instantane` → infrahoraire 6 min ; `heure` → horaire. Pas de `qh` / `jour` / `2min` |
| Réseaux | Stations terrestres + bouées. **Pas de SYNOP** ni navires |
| Affichage | Marqueurs physiques distincts (losange SVG), cohabitation avec marqueurs AQ |
| Menu | Renommé **Variable** : sous-sections Polluant + Météo |
| Couverture | Filtrage par **bbox viewport** + seuil **zoom ≥ 8** (en dur, config domaine plus tard) |
| Auth PoC | JWT statique `METEOFRANCE_API_TOKEN` (renouvellement manuel ~1 h) |
| Auth après PoC | OAuth2 `client_credentials` (APPLICATION_ID) — hors scope |
| API base | **DPObs v1** (le JWT PoC actuel reçoit 403 sur v2) |

---

## Architecture

```text
UI (Variable + Sources + TimeStep)
        │
        ▼
useAirQualityData (bounds + zoom + meteoVariable)
        │
        ▼
MeteoFranceService  ──fetch──►  /api/meteofrance/*
        │                              │
        │                              ▼
        │                     JWT Bearer (serveur)
        │                              │
        ▼                              ▼
Marqueurs carte              public-api.meteofrance.fr/public/DPObs/v1
```

Le navigateur **n’appelle jamais** Météo-France directement : le secret reste côté serveur Next.js.

---

## Ce qui a été implémenté

### 1. Proxy API Next.js

- Route catch-all : `app/api/meteofrance/[...path]/route.ts`
- Helper : `src/lib/meteofrance.ts` (`METEOFRANCE_API_TOKEN`, base URL configurable)
- Doc env : `.env.inc`

### 2. Correctif middleware (bloquant)

`next-intl` interceptait `/api/*` → 404 HTML.  
**Fix** : exclure `/api` du matcher et court-circuiter le middleware i18n (comme `/aircarto` / `/feuxdeforet`) dans `middleware.ts`.

### 3. Source & service

- Entrée `meteoFrance` dans `src/constants/sources.ts`
- Variables / seuils couleur : `src/constants/meteoVariables.ts`
- Service : `src/services/MeteoFranceService.ts`
  - cache listes stations / bouées
  - filtre bbox
  - 1 requête / station terrestre (concurrence limitée)
  - multi-id pour les bouées
  - conversion Kelvin → °C pour la température
- Enregistrement factory : `DataServiceFactory`

### 4. Menu Variables & état App

- Nouveau contrôle : `VariableDropdown.tsx`
- Rail : `RailFiltersSection` (label Variable, section météo si source MF cochée)
- État `selectedMeteoVariable` (défaut `vent`) + sync URL `?meteo=`
- Contexte contrôles carte étendu (`mapControlsContext`)

### 5. Bbox carte

- `MapViewSyncHandler` émet aussi les bounds
- `useAirQualityData` passe `bounds` / `zoom` au service MF
- Debounce ~400 ms + arrondi bbox pour limiter les refetch au pan

### 6. Marqueurs

- Assets SVG : `public/markers/meteoFranceMarkers/`
- Config `markers.ts` (extension `.svg` pour MF)
- Rendu : valeur numérique, flèche direction pour le vent, tooltips i18n

### 7. i18n

- FR / EN : libellés source, variables météo, catégorie « Météo », `controls.variable`

---

## Fichiers principaux

| Fichier | Rôle |
|---------|------|
| `app/api/meteofrance/[...path]/route.ts` | Proxy DPObs |
| `src/lib/meteofrance.ts` | Token + fetch upstream |
| `src/services/MeteoFranceService.ts` | Métier source |
| `src/constants/meteoVariables.ts` | Vent / T° / humidité / précip. |
| `src/components/controls/VariableDropdown.tsx` | Menu Variables |
| `middleware.ts` | Exclusion `/api` de next-intl |
| `src/hooks/useAirQualityData.ts` | Orchestration fetch + bbox |
| `.env.inc` | Documentation `METEOFRANCE_API_TOKEN` |

---

## Comment tester le PoC

1. Sur le [portail API MF](https://portail-api.meteofrance.fr/web/fr/api/DonneesPubliquesObservation) : s’abonner à **DonneesPubliquesObservation**, générer un JWT.
2. Dans `.env.local` (jamais committer) :

```bash
METEOFRANCE_API_TOKEN=<jwt>
```

3. Redémarrer `npm run dev`.
4. Sur la carte : zoom ≥ 8, cocher **Météo-France**, pas de temps **Scan** ou **Heure**.
5. Choisir une variable météo dans le menu **Variable**.

Le token expire environ toutes les heures : le régénérer sur le portail si 401.

Vérification proxy :

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/meteofrance/liste-stations
# attendu : 200
```

---

## Limites connues (PoC)

- JWT manuel (pas de refresh OAuth2).
- Quota gratuit typique ~50 req/min → risque au zoom large malgré bbox + concurrence.
- Zoom min et base URL en dur (pas encore config par domaine).
- Pas d’historique TimeBar / panneau détail dédié pour MF.
- Pas de SYNOP / navires / climatologie.
- `format=geojson` sur `liste-stations` peut renvoyer du CSV : le service parse les deux.

---

## Suite possible

1. Auth OAuth2 `client_credentials` + cache token serveur.
2. Basculer / tester DPObs **v2** avec un abonnement adapté.
3. Config domaine : zoom min, activation par défaut, emprise.
4. Sous-sources Stations / Bouées optionnelles.
5. UX vent (flèche / barbules) et légende météo dédiée.
6. Tests unitaires service + e2e activation source MF.
