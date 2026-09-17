# OpenAirMap — instance AirCrowd

[OpenAirMap](https://openairmap.fr) est une application web de visualisation de la qualité de l’air sur carte interactive. Cette branche porte l’**instance AirCrowd** (secteur Gardanne / Meyreuil), opérée par AtmoSud.

Site : [https://aircrowd.atmosud.org](https://aircrowd.atmosud.org)

## Table des matières

- [Périmètre de l’instance](#périmètre-de-linstance)
- [Stack](#stack)
- [Prérequis](#prérequis)
- [Installation et commandes](#installation-et-commandes)
- [Configuration](#configuration)
- [Déploiement](#déploiement)
- [Structure du projet](#structure-du-projet)

## Périmètre de l’instance

Résolu par hostname via [`src/config/domainConfig.ts`](src/config/domainConfig.ts) (clé `aircrowd.atmosud.org`) et filtré côté UI par [`src/utils/domainDataScope.ts`](src/utils/domainDataScope.ts).

| Élément | Comportement AirCrowd |
| --- | --- |
| Polluants | PM₂.₅ et PM₁₀ uniquement |
| Sources de mesures | Stations de référence AtmoSud + microcapteurs qualifiés AtmoSud |
| Modélisation | AzurH **et** cartographie WMS AirCrowd |
| Pas de temps | **Horaire uniquement** |
| Langue par défaut | Anglais |
| À l’arrivée | Stations + microcapteurs + couche WMS AirCrowd activés |

**Carte** : centrage / zoom sur Gardanne ; emprise données Gardanne–Meyreuil ; navigation limitée avec dézoom possible jusqu’à voir Marseille (`mapMinZoom` / `mapMaxBounds`).

**Whitelist microcapteurs** : seuls les sites de la campagne (IDs API historique + `device.id` Microspot) sont affichés. Liste à jour dans `domainConfig` (`atmoMicroAllowedSiteIds`).

**WMS AirCrowd** : couche de cartographie (geoservices preprod), exposée dans le menu fond de carte, pilotée par date et heure ; activée par défaut à l’arrivée (`aircrowdWmsEnabled`, `aircrowdWmsStartDate`).

## Stack

- **Next.js 15** (App Router, `output: 'standalone'`)
- React 19 + TypeScript
- Leaflet / React-Leaflet
- Tailwind CSS
- next-intl (i18n)

## Prérequis

- **Node.js** : `>= 20.19.0` (recommandé) ou `>= 22.12.0`
- **npm** 10+
- **Git**

## Installation et commandes

```bash
npm run lint
npm run test:run
npm ci
cp .env.inc .env
npm run dev      # http://localhost:3000
npm run build    # next build + préparation standalone
npm start        # Node standalone (HOSTNAME/PORT via env)
```

## Configuration

Gabarit : [`.env.inc`](.env.inc). Copier vers `.env` puis adapter.

### Auth partagée

Connexion par identifiant / mot de passe unique, optionnelle, via les variables serveur `SHARED_AUTH_*` (non exposées au client). Détail : [`docs/SHARED_AUTH.md`](docs/SHARED_AUTH.md).

### Résumé des variables (`.env.inc`)

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_MAINTENANCE_MODE` | Page de maintenance (build / client) |
| `NEXT_PUBLIC_FORCE_DOMAIN_CONFIG` | Forcer une entrée `domainConfig` (dev) |
| `NOINDEX` | `noindex` + robots restrictifs + sitemap vide (serveur) |
| `SHARED_AUTH_ENABLED` | Active l’écran de connexion (login / mot de passe) |
| `SHARED_AUTH_USER` | Identifiant partagé |
| `SHARED_AUTH_PASSWORD` | Mot de passe partagé |
| `SHARED_AUTH_SECRET` | Secret HMAC du cookie de session |
| `NEXT_PUBLIC_ENABLE_WILDFIRE_LAYER` | Couche feuxdeforet.fr |
| `NEXT_PUBLIC_SOLID_LINE_NEBULEAIR` | Traces NebuleAir en ligne continue |
| `NEXT_PUBLIC_MARKER_NEBULEAIR` | Marqueur dédié NebuleAir |
| `NEXT_PUBLIC_TOOLTIP_MIN_ZOOM` | Zoom mini des tooltips (`number` ou `false`) |
| `NEXT_PUBLIC_USE_ADVERTISING` | Encart promo capteurs |
| `NEXT_PUBLIC_SENSOR_SHOP_URL` | URL du CTA boutique |
| `NEXT_PUBLIC_MATOMO_*` | Analytics Matomo |
| `NEXT_PUBLIC_USE_MICROSPOT_API` | Microspot à la place d’AtmoMicro legacy |
| `NEXT_PUBLIC_HISTORICAL_MODE_LOGS` | Logs debug mode historique |

Les `NEXT_PUBLIC_*` sont figées **au build**. Les variables serveur (`SHARED_AUTH_*`, `NOINDEX`) sont lues au **runtime** (redémarrage du process Node après modification).

## Déploiement

Build Next **standalone** derrière un reverse-proxy Nginx. Guide détaillé : [`docs/DEPLOIEMENT_NEXT.md`](docs/DEPLOIEMENT_NEXT.md).

```bash
npm ci
npm run build    # inclut la copie des assets dans .next/standalone
npm start        # ou service systemd équivalent
```

- Nginx : proxy vers le process Node (exemple générique [`deploy/nginx-openairmap.conf.example`](deploy/nginx-openairmap.conf.example)) — headers `Host` / `X-Forwarded-*` nécessaires pour `domainConfig` et l’auth.
- **Runtime léger** : faire tourner le bundle `.next/standalone` (avec `public` et `.next/static`), pas le `node_modules` complet du dépôt (~1 Go). Le script `prepare-standalone` est enchaîné sur `npm run build`.

## Structure du projet

```text
app/                      # routes App Router (pages, API auth)
middleware.ts             # i18n, cookie Host, gate SHARED_AUTH
src/
  config/domainConfig.ts  # branding + périmètre AirCrowd par hostname
  utils/domainDataScope.ts
  components/             # carte, contrôles, panneaux
  services/               # APIs et couches (dont WMS AirCrowd)
  constants/              # polluants, sources, pas de temps
  locales/                # traductions
deploy/                   # exemples Nginx / systemd
```
