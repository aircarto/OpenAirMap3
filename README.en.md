# OpenAirMap

> Version française : [README.md](README.md)

React/TypeScript web app for visualizing air quality on an interactive map (Leaflet), with filtering by pollutant, data sources, and time step.

## Quick overview

OpenAirMap lets you:

- display measurement devices on a map with thematic markers;
- combine several data sources (AtmoRef, AtmoMicro, NebuleAir, PurpleAir, SensorCommunity, etc.);
- inspect details in side panels;
- use historical mode to replay past periods;
- switch language and adapt branding/config per domain.

Internationalization: see [docs/INTERNATIONALISATION_I18N.md](docs/INTERNATIONALISATION_I18N.md).

## Tech stack

- React 19 + TypeScript
- Next.js 15 (App Router, `output: 'standalone'`)
- Leaflet / React-Leaflet
- Tailwind CSS

## Prerequisites

- **Node.js**: `>= 20.19.0` (declared in `package.json` → `engines.node`, aligned with Next.js 15); Node 22 LTS recommended in production
- **npm**: recent version (npm 10+ recommended)
- **Git**

## Local setup

```bash
git clone <repo-url>
cd OpenAirMap3
npm ci
cp .env.inc .env   # adjust values as needed
npm run dev
```

App available at `http://localhost:3000`.

## Configuration

### Environment variables

The project ships a template [`.env.inc`](.env.inc). Copy it to `.env` and adapt values for your environment.

```bash
cp .env.inc .env
```

Notes:

- client-exposed variables must be prefixed with `NEXT_PUBLIC_`;
- they are injected **at build time**: in production, any `NEXT_PUBLIC_*` change requires `npm run build` then a Node process restart;
- `NEXT_PUBLIC_MAINTENANCE_MODE=true` shows a maintenance page and prevents the map from loading;
- `NEXT_PUBLIC_TOOLTIP_MIN_ZOOM` accepts a number (e.g. `11`) or `false` to disable the zoom threshold;
- full feature-flag list and add patterns: [docs/FEATURE_FLAGS.md](docs/FEATURE_FLAGS.md).

### Maintenance mode

Maintenance mode is controlled by `NEXT_PUBLIC_MAINTENANCE_MODE`.
When active, OpenAirMap only shows a maintenance page and does not mount the Leaflet map or data calls (gate in `src/components/MapAppEntry.tsx`).

Accepted values:

- on: `true`, `1`, `on`, `yes`, `enabled`;
- off: `false`, `0`, `off`, `no`, `disabled`.

Example:

```bash
NEXT_PUBLIC_MAINTENANCE_MODE=true
```

In development, restart `npm run dev` after changing `.env`.
In production, rebuild and redeploy the standalone server.

#### Customize the message

Page copy is configured in `public/maintenance.json`.
Maintainers can change content without touching React code:

```json
{
  "title": "Maintenance en cours",
  "message": "La plateforme est temporairement indisponible pendant une opération de maintenance.",
  "details": "Merci de réessayer un peu plus tard.",
  "contactLabel": "Contacter l'équipe",
  "atmoMicroQualifiedSensors": {
    "enabled": true,
    "message": "Suite à un problème technique, les données des capteurs qualifiés ne sont plus accessibles. AtmoSud met tout en œuvre pour le résoudre."
  }
}
```

Available fields:

- `title`: main page title;
- `message`: primary explanation;
- `details`: short complementary text under the message;
- `contactLabel`: contact button label;
- `atmoMicroQualifiedSensors.enabled`: enable/disable the AtmoMicro incident banner;
- `atmoMicroQualifiedSensors.message`: AtmoMicro incident banner text.

#### AtmoMicro incident banner (`mesures/dernieres`)

OpenAirMap supports a degraded mode for AtmoMicro when `mesures/dernieres` does not return usable measurements, for example:

- `204 No Content` or empty body (`null`);
- empty JSON array (`[]`);
- network or HTTP error on that endpoint only.

Applied behaviour:

- an `atmoMicroOutage` incident state is set in `useAirQualityData` (for the banner);
- sensors listed in `capteurs/sites` for the requested pollutant remain as **inactive markers** (grey, no recent value), positions from site metadata;
- an information banner is shown at the top of the map when AtmoMicro is selected;
- banner text comes from `public/maintenance.json` (`atmoMicroQualifiedSensors.message`);
- the user can dismiss the banner via a close button (local UI session only).

Related files:

- `src/services/AtmoMicroService.ts` (measures → sites fallback, `isMeasuresUnavailableIncident`);
- `src/hooks/useAirQualityData.ts` (propagates `atmoMicroOutage`);
- `src/App.tsx` (banner render, centred text, close button);
- `public/maintenance.json` (message configuration).

This file is served as a static asset. In production, maintainers can edit deployed `maintenance.json` without changing React code. Missing or empty fields fall back to the default message.

Typical procedure:

1. Set `NEXT_PUBLIC_MAINTENANCE_MODE=true` in the build environment;
2. Build and deploy the application;
3. Optionally edit deployed `maintenance.json` to adjust the message;
4. Turn maintenance off with `NEXT_PUBLIC_MAINTENANCE_MODE=false`, then rebuild and redeploy.

Cache note: `maintenance.json` is fetched with a browser `no-store` strategy. If a proxy, CDN, or Nginx caches it further, purge that cache or configure a short TTL for this file.

### Domain configuration (`src/config/domainConfig.ts`)

Branding, institutional links, and SEO metadata live in `src/config/domainConfig.ts`.

Main structure:

- `DOMAIN_CONFIG.default` holds the default configuration (logo, favicon, map centre/zoom/bounds, title, description, links, organisation, legal notices);
- `getConfigForDomain(domain)` applies the config for the current domain, falling back to `DOMAIN_CONFIG.default` when there is no dedicated entry;
- the AtmoSud instance (`atmosud`) is an example dedicated entry: it is selected for any hostname ending in `*.atmosud.org` (see `isAtmoSudHost`), not only an exact match — useful to cover prod + preprod without duplicating config.

Fields on a `DomainConfig` entry:

| Field | Usage |
|---|---|
| `logo`, `logo2`, `favicon` | Assets in the header and browser tab |
| `mapCenter`, `mapZoom`, `mapBounds` | Initial map view **and** real instance footprint (see SEO section) |
| `title` | Shown in the navbar — keep it short |
| `seoTitle` (optional) | Used for `<title>` / `document.title` instead of `title` when a more descriptive label is needed without breaking the UI |
| `description` | `<meta name="description">`, JSON-LD, and “About” panel under the header |
| `earliestMeasurementDate` (optional, `YYYY-MM-DD`) | First usable measurement date for **this** instance network, for JSON-LD `temporalCoverage` — only if known and verified |
| `links.website/contact/about` | Institutional links in the app and legal notices |
| `organization` | Name of the entity operating this instance |
| `legal` (optional) | Legal notices (SIRET, legal form, address, legal representative, host, DPO…) shown in the information modal |

To add a new domain:

1. Add an entry in `DOMAIN_CONFIG` with an explicit key (not necessarily the exact hostname; see `atmosud` + `isAtmoSudHost`);
2. Fill all fields above with real instance values (see SEO checklist below);
3. Adjust `getConfigForDomain` if needed so that hostname(s) resolve correctly;
4. Check header, favicon, map centring, and the “About” panel.

### SEO — checklist per instance

Several organisations deploy OpenAirMap on different domains from the **same codebase**. Without differentiation, instances serve nearly identical content and Google treats them as duplicates: only one appears in generic search results (this happened to `openairmap.atmosud.org`, invisible for months behind `openairmap.fr`).

What the app already does **automatically** once an instance has its own `DOMAIN_CONFIG` entry:

- self-referencing `<link rel="canonical">` (see `useCanonicalUrl`);
- `<meta name="description">` (see `useMetaDescription`);
- JSON-LD `Dataset` (see `useStructuredData` / `structuredData.ts`), with `spatialCoverage` derived from `mapBounds`;
- “About” panel always present in the DOM, even collapsed (see `AboutPanel`), with `description` as the first paragraph.

What **each instance must fill itself** in `domainConfig.ts` for real differentiation (do not just copy another instance):

- [ ] **A dedicated `DOMAIN_CONFIG` entry** (do not stay on `default`, the generic/France fallback);
- [ ] **`title` / `seoTitle`** truly different from other instances — not just “OpenAirMap” everywhere;
- [ ] **`description`** that really describes *this* instance (area, audience, data source) — short, factual, no keyword stuffing;
- [ ] **`mapCenter` / `mapZoom` / `mapBounds`** matching the geographic area covered (not South region / France if that is not the scope) — this also feeds JSON-LD `spatialCoverage`, the hardest signal for Google to confuse with another instance;
- [ ] **`organization`** = real operating entity name;
- [ ] **`links.website/contact/about`** = that organisation’s real links, not AtmoSud’s;
- [ ] **`legal`** = that organisation’s real legal notices — must be filled by the organisation itself;
- [ ] **`earliestMeasurementDate`** (optional) only if the first usable measurement date is known and verified;
- [ ] **`logo` / `logo2` / `favicon`** specific to the instance, under `public/`.

### StadiaMaps basemap

The default basemap (`Carte standard`) uses StadiaMaps.

Operational prerequisites:

- create a StadiaMaps account;
- whitelist allowed domains in StadiaMaps, including production.

Symptoms of bad StadiaMaps configuration:

- tile network errors in the browser console;
- `401 Unauthorized` if the current domain is not allowed;
- missing basemap.

### Tile fallback procedure

An alternative is already built in: `Carte OSM` (OpenStreetMap), alongside `Carte standard` (StadiaMaps) and `Satellite IGN`.

Switch without redeploy:

1. Open the basemap layer menu on the map;
2. Select `Carte OSM`;
3. Confirm OSM tiles render correctly.

Recommended use: `Carte OSM` as continuity if StadiaMaps returns `401` (or temporary outage).

### Wildfire / hot-spot overlays

The basemap menu also offers fire layers (independent from measurement sources):

- **EFFIS**: 7-day hot spots (GWIS WFS + WMS fallback) + seasonal burned areas (no API key);
- **feuxdeforet.fr**: report markers (flag `NEXT_PUBLIC_ENABLE_WILDFIRE_LAYER`).

Technical docs: [`docs/features/DOCUMENTATION_COUCHES_FEUX.md`](docs/features/DOCUMENTATION_COUCHES_FEUX.md).

## Useful commands

```bash
npm run dev         # dev server (http://localhost:3000)
npm run build       # production standalone build (+ asset copy)
npm run start       # Node standalone server (HOSTNAME=0.0.0.0)
npm run lint        # ESLint
npm run typecheck   # TypeScript check (dedicated script)
npm run test:run    # Vitest unit tests
npm run test:e2e    # Playwright tests
```

## Project structure

```text
app/                       # Next.js App Router (layouts, [locale] routes, robots, sitemap)
src/
  components/
    MapAppEntry.tsx        # maintenance gate → map
    controls/              # UI menus and controls
    map/                   # map, markers, layers
    panels/                # per-source side panels
    charts/                # historical charts
  App.tsx                  # map shell / UI state (not the Next root)
  services/                # data access and normalisation
  hooks/                   # shared business logic
  constants/               # pollutants, sources, time steps
  config/                  # domain config / feature flags
  lib/                     # env, domain, SEO helpers
  i18n/                    # next-intl + i18next sync
  locales/                 # translation files
deploy/                    # systemd unit + Nginx example
scripts/                   # prepare-standalone, typecheck, etc.
```

Runtime entry flow:

1. `app/[locale]/…` (Next) mounts the localised UI;
2. `MapAppEntry` switches maintenance / map;
3. `App.tsx` owns filter state and orchestrates hooks + map.

Oral onboarding (90 min): [docs/ONBOARDING.md](docs/ONBOARDING.md).

## Time-step compatibility (general rule)

### Source of truth

- UI time-step availability is driven by `src/constants/sources.ts` via `supportedTimeSteps`.
- Each data service must actually support the announced steps (mapping, API queries, transform).
- UI config and service implementation must stay aligned to avoid inconsistent states (active button but empty data, or the reverse).

### Screen behaviour

- Source-specific panels enable/disable buttons according to source compatibility.
- The comparison panel applies an intersection rule: a time step is only enabled if every compared source supports it.
- Automatic fallback to a priority valid step (`heure`, then `quartHeure`, then `instantane`) when the current step becomes invalid.

### Evolving a time step for a source

To add (or remove) a time step on a given source:

1. Update `supportedTimeSteps` in `src/constants/sources.ts`.
2. Update the related service so it really supports that step (mapping / config / queries).
3. Check source and comparison panels for button state and chart loading.

Concrete example: AtmoMicro does not expose `jour` on the API yet, so that step stays disabled until the service supports it.

## Production deployment (Next.js + Nginx)

This project deploys as a **Next.js standalone** app (Node process) behind Nginx.
Detailed guide: [docs/DEPLOIEMENT_NEXT.md](docs/DEPLOIEMENT_NEXT.md).

### Procedure

1. On the VM, place/update the code and `.env` (template [`.env.inc`](.env.inc)). `NEXT_PUBLIC_*` and `NOINDEX` must be correct **before** the build.
2. Build:

```bash
npm ci
npm run build
```

`npm run build` runs `next build` then [`scripts/prepare-standalone.mjs`](scripts/prepare-standalone.mjs), which copies `public/` and `.next/static` into `.next/standalone`. **No manual `cp` is required.**

3. Start the Node process:

- via systemd: [`deploy/openairmap.service`](deploy/openairmap.service) (`WorkingDirectory` = deploy root, `HOSTNAME=0.0.0.0`, `PORT=3000`, `EnvironmentFile` = `.env`);
- or manually: `npm run start` (equivalent to `node .next/standalone/server.js`).

4. Nginx reverse proxy: example [`deploy/nginx-openairmap.conf.example`](deploy/nginx-openairmap.conf.example).

After any `NEXT_PUBLIC_*` change: rebuild + `systemctl restart openairmap`.

## Further documentation

- [Technical documentation](docs/features/DOCUMENTATION_TECHNIQUE.md)
- [Feature flags](docs/FEATURE_FLAGS.md)
- [Internationalization](docs/INTERNATIONALISATION_I18N.md)
- [Next.js deployment](docs/DEPLOIEMENT_NEXT.md)
- [Onboarding script](docs/ONBOARDING.md)
- [Historical mode](docs/features/DOCUMENTATION_MODE_HISTORIQUE.md)
- [Intercomparison](docs/features/DOCUMENTATION_INTERCOMPARAISON.md)
- [Search feature](docs/features/DOCUMENTATION_SEARCH_FEATURE.md)
- [useAirQualityData hook](docs/features/DOCUMENTATION_USE_AIR_QUALITY_DATA.md)
- [Wildfire layers](docs/features/DOCUMENTATION_COUCHES_FEUX.md)
