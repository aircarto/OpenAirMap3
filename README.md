# OpenAirMap

> English version: [README.en.md](README.en.md)

Application web React/TypeScript de visualisation de la qualité de l'air sur carte interactive (Leaflet), avec filtrage par polluant, sources et pas de temps.

## Présentation rapide

OpenAirMap permet de :

- afficher des appareils de mesure sur une carte avec marqueurs thématiques ;
- croiser plusieurs sources de données (AtmoRef, AtmoMicro, NebuleAir, PurpleAir, SensorCommunity, etc.) ;
- consulter les détails dans des panneaux latéraux ;
- utiliser un mode historique pour rejouer des périodes passées ;
- basculer de langue et adapter l'application selon le domaine (branding / config).

Internationalisation : voir [docs/INTERNATIONALISATION_I18N.md](docs/INTERNATIONALISATION_I18N.md).

## Stack technique

- React 19 + TypeScript
- Next.js 15 (App Router, `output: 'standalone'`)
- Leaflet / React-Leaflet
- Tailwind CSS

## Prérequis

- **Node.js** : `>= 20.19.0` (contrainte déclarée dans `package.json` → `engines.node`, alignée sur Next.js 15) ; Node 22 LTS recommandé en production
- **npm** : version récente (npm 10+ recommandé)
- **Git**

## Installation locale

```bash
git clone <url-du-repo>
cd OpenAirMap3
npm ci
cp .env.inc .env   # adapter les valeurs si besoin
npm run dev
```

Application disponible sur `http://localhost:3000`.

## Configuration

### Variables d'environnement

Le projet fournit un gabarit [`.env.inc`](.env.inc). Copiez-le vers `.env` puis adaptez les valeurs selon votre environnement.

```bash
cp .env.inc .env
```

Notes :

- les variables exposées au client doivent être préfixées par `NEXT_PUBLIC_` ;
- elles sont injectées **au build** : en production, tout changement de `NEXT_PUBLIC_*` impose un `npm run build` puis un redémarrage du process Node ;
- `NEXT_PUBLIC_MAINTENANCE_MODE=true` affiche une page de maintenance et empêche le chargement de la carte ;
- `NEXT_PUBLIC_TOOLTIP_MIN_ZOOM` accepte un nombre (ex. `11`) ou `false` pour désactiver le seuil de zoom ;
- liste complète des feature flags et patterns d'ajout : [docs/FEATURE_FLAGS.md](docs/FEATURE_FLAGS.md).

### Mode maintenance

Le mode maintenance se pilote avec le feature flag `NEXT_PUBLIC_MAINTENANCE_MODE`.
Quand il est actif, OpenAirMap affiche uniquement une page de maintenance et ne monte pas la carte Leaflet ni les appels de données (gate dans `src/components/MapAppEntry.tsx`).

Valeurs acceptées :

- actif : `true`, `1`, `on`, `yes`, `enabled` ;
- inactif : `false`, `0`, `off`, `no`, `disabled`.

Exemple :

```bash
NEXT_PUBLIC_MAINTENANCE_MODE=true
```

En développement, redémarrez `npm run dev` après modification du `.env`.
En production, relancez un build puis redéployez le serveur standalone.

#### Personnaliser le message

Le texte affiché sur la page se configure dans `public/maintenance.json`.
Ce fichier permet au mainteneur de changer le contenu sans modifier le code React :

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

Champs disponibles :

- `title` : titre principal de la page ;
- `message` : message explicatif principal ;
- `details` : texte court complémentaire affiché sous le message ;
- `contactLabel` : libellé du bouton de contact ;
- `atmoMicroQualifiedSensors.enabled` : active / désactive le bandeau incident AtmoMicro ;
- `atmoMicroQualifiedSensors.message` : texte du bandeau incident AtmoMicro.

#### Bandeau incident AtmoMicro (`mesures/dernieres`)

OpenAirMap gère un mode dégradé pour AtmoMicro lorsque l'endpoint `mesures/dernieres` ne fournit pas de mesures exploitables, par exemple :

- `204 No Content` ou corps vide (`null`) ;
- réponse JSON vide (`[]`) ;
- erreur réseau ou HTTP sur cet endpoint uniquement.

Comportement appliqué :

- un état d'incident `atmoMicroOutage` est activé dans le hook `useAirQualityData` (pour le bandeau) ;
- les capteurs listés dans `capteurs/sites` pour le polluant demandé restent affichés en **marqueurs inactifs** (gris, pas de valeur récente), positions issues des métadonnées sites ;
- un bandeau d'information est affiché en haut de la carte si AtmoMicro est sélectionnée ;
- le texte du bandeau provient de `public/maintenance.json` (`atmoMicroQualifiedSensors.message`) ;
- l'utilisateur peut fermer le bandeau via une croix (fermeture locale de session UI).

Fichiers concernés :

- `src/services/AtmoMicroService.ts` (fallback mesures → sites, signal `isMeasuresUnavailableIncident`) ;
- `src/hooks/useAirQualityData.ts` (propagation de `atmoMicroOutage`) ;
- `src/App.tsx` (rendu du bandeau, texte centré, bouton de fermeture) ;
- `public/maintenance.json` (configuration du message).

Ce fichier est servi comme un fichier statique. En production, le mainteneur peut donc modifier `maintenance.json` dans les fichiers déployés sans modifier le code React. Les champs absents ou vides utilisent automatiquement le message par défaut.

Procédure type :

1. Activer `NEXT_PUBLIC_MAINTENANCE_MODE=true` dans l'environnement de build ;
2. Builder et déployer l'application ;
3. Modifier si besoin le fichier déployé `maintenance.json` pour adapter le message ;
4. Désactiver la maintenance en repassant `NEXT_PUBLIC_MAINTENANCE_MODE=false`, puis rebuilder et redéployer.

Note cache : `maintenance.json` est chargé avec une stratégie `no-store` côté navigateur pour faciliter les changements de message. Si un proxy, CDN ou Nginx applique un cache supplémentaire, purgez ce cache ou configurez une durée courte pour ce fichier.

### Configuration domaine (`src/config/domainConfig.ts`)

Le branding, les liens institutionnels et les métadonnées SEO sont portés par `src/config/domainConfig.ts`.

Structure principale :

- `DOMAIN_CONFIG.default` contient la configuration par défaut (logo, favicon, centre / zoom / emprise de carte, titre, description, liens, organisation, mentions légales) ;
- `getConfigForDomain(domain)` applique la config associée au domaine courant, avec repli automatique vers `DOMAIN_CONFIG.default` si le domaine n'a pas d'entrée dédiée ;
- l'instance AtmoSud (`atmosud`) est un exemple d'entrée dédiée : elle est sélectionnée pour tout hostname en `*.atmosud.org` (voir `isAtmoSudHost`), pas seulement une correspondance exacte — utile pour couvrir prod + preprod sans dupliquer la config.

Champs disponibles sur une entrée (`DomainConfig`) :

| Champ | Usage |
|---|---|
| `logo`, `logo2`, `favicon` | Assets affichés dans le header et l'onglet du navigateur |
| `mapCenter`, `mapZoom`, `mapBounds` | Vue initiale de la carte **et** emprise réelle de l'instance (voir section Référencement) |
| `title` | Affiché dans la navbar — à garder court |
| `seoTitle` (optionnel) | Utilisé pour `<title>` / `document.title` à la place de `title` si un libellé plus descriptif est souhaité sans casser l'UI |
| `description` | `<meta name="description">`, JSON-LD, et panneau « À propos » sous le header |
| `earliestMeasurementDate` (optionnel, `YYYY-MM-DD`) | Date de première mesure exploitable du réseau de **cette** instance, pour `temporalCoverage` (JSON-LD) — ne renseigner que si connue et vérifiée, sinon laisser absent |
| `links.website/contact/about` | Liens institutionnels affichés dans l'app et les mentions légales |
| `organization` | Nom de l'entité qui opère cette instance |
| `legal` (optionnel) | Mentions légales (SIRET, forme juridique, adresse, représentant légal, hébergeur, DPO…) affichées dans la modale d'information |

Pour ajouter un nouveau domaine :

1. Ajouter une entrée dans `DOMAIN_CONFIG` avec une clé explicite (pas forcément le hostname exact, voir `atmosud` + `isAtmoSudHost`) ;
2. Renseigner tous les champs du tableau ci-dessus avec les vraies valeurs de l'instance (voir checklist Référencement ci-dessous) ;
3. Ajuster `getConfigForDomain` si nécessaire pour que le(s) hostname(s) de cette instance y soient correctement résolus ;
4. Vérifier le rendu du header, du favicon, du centrage de carte, et le panneau « À propos ».

### Référencement (SEO) — checklist pour chaque instance

Plusieurs organisations déploient OpenAirMap sur des domaines différents à partir du **même code**. Sans différenciation, ces instances servent un contenu quasiment identique et Google les traite comme des doublons : il n'en montre qu'une dans les résultats de recherche génériques, au détriment des autres (c'est ce qui est arrivé à `openairmap.atmosud.org`, invisible pendant plusieurs mois face à `openairmap.fr`).

Ce que fait déjà l'app **automatiquement**, sans configuration supplémentaire, une fois qu'une instance a sa propre entrée dans `DOMAIN_CONFIG` :

- `<link rel="canonical">` auto-référent (voir `useCanonicalUrl`) ;
- `<meta name="description">` (voir `useMetaDescription`) ;
- JSON-LD `Dataset` (voir `useStructuredData` / `structuredData.ts`), avec `spatialCoverage` dérivé de `mapBounds` ;
- panneau « À propos » toujours présent dans le DOM, même replié (voir `AboutPanel`), avec `description` en premier paragraphe.

Ce que **chaque instance doit renseigner elle-même** dans `domainConfig.ts` pour que cette différenciation soit réelle (pas juste copier la config d'une autre instance) :

- [ ] **Une entrée dédiée dans `DOMAIN_CONFIG`** (ne pas rester sur `default`, qui est le repli générique / France) ;
- [ ] **`title` / `seoTitle`** vraiment différents des autres instances — pas juste « OpenAirMap » partout ;
- [ ] **`description`** qui décrit réellement ce que couvre *cette* instance (zone, public, source des données) — court, factuel, pas de bourrage de mots-clés ;
- [ ] **`mapCenter` / `mapZoom` / `mapBounds`** correspondant à la vraie zone géographique couverte par cette instance (pas la région Sud, pas la France, si ce n'est pas son périmètre) — cela alimente aussi `spatialCoverage` du JSON-LD, c'est la différence la plus difficile à confondre avec une autre instance pour Google ;
- [ ] **`organization`** = le nom réel de l'entité qui opère cette instance ;
- [ ] **`links.website/contact/about`** = les vrais liens de cette organisation, pas ceux d'AtmoSud ;
- [ ] **`legal`** = les vraies mentions légales de l'organisation qui opère l'instance (SIRET, forme juridique, adresse, représentant légal, hébergeur, DPO…) — à renseigner par l'organisation elle-même ;
- [ ] **`earliestMeasurementDate`** (optionnel) uniquement si la date de première mesure exploitable du réseau de cette instance est connue et vérifiée ;
- [ ] **`logo` / `logo2` / `favicon`** propres à l'instance, ajoutés dans `public/`.

### Fond de carte StadiaMaps

Le fond de carte par défaut (`Carte standard`) utilise StadiaMaps.

Prérequis opérationnel :

- créer un compte StadiaMaps ;
- déclarer dans StadiaMaps la liste des domaines autorisés (whitelist), incluant le domaine de production.

Symptômes en cas de mauvaise configuration StadiaMaps :

- erreurs réseau sur les tuiles dans la console navigateur ;
- statut `401 Unauthorized` si le domaine courant n'est pas autorisé ;
- fond de carte absent.

### Alternative de tuiles et procédure de bascule

Une alternative est déjà intégrée : `Carte OSM` (OpenStreetMap), en plus de `Carte standard` (StadiaMaps) et `Satellite IGN`.

Procédure de bascule (sans redéploiement) :

1. Ouvrir le menu des couches de fond dans l'interface carte ;
2. Sélectionner `Carte OSM` ;
3. Vérifier que les tuiles OSM s'affichent correctement.

Cas d'usage recommandé : utiliser `Carte OSM` comme solution de continuité si StadiaMaps renvoie des `401` (ou indisponibilité temporaire).

### Overlays feux / points chauds

Le menu des fonds de carte propose aussi des couches d'incendie (indépendantes des sources de mesures) :

- **EFFIS** : points de chaleur 7 jours (WFS GWIS + repli WMS) + zones brûlées saison (pas de clé API) ;
- **feuxdeforet.fr** : marqueurs de signalements (flag `NEXT_PUBLIC_ENABLE_WILDFIRE_LAYER`).

Documentation technique : [`docs/features/DOCUMENTATION_COUCHES_FEUX.md`](docs/features/DOCUMENTATION_COUCHES_FEUX.md).

## Commandes utiles

```bash
npm run dev         # serveur de dev (http://localhost:3000)
npm run build       # build production standalone (+ copie assets)
npm run start       # serveur Node standalone (HOSTNAME=0.0.0.0)
npm run lint        # vérification ESLint
npm run typecheck   # contrôle TypeScript (script dédié)
npm run test:run    # tests unitaires Vitest
npm run test:e2e    # tests Playwright
```

## Structure du projet

```text
app/                       # Next.js App Router (layouts, routes [locale], robots, sitemap)
src/
  components/
    MapAppEntry.tsx        # gate maintenance → carte
    controls/              # menus et contrôles UI
    map/                   # carte, marqueurs, couches
    panels/                # side panels par source
    charts/                # visualisations historiques
  App.tsx                  # shell carte / état UI (pas le root Next)
  services/                # accès et normalisation des données
  hooks/                   # logique métier partagée
  constants/               # polluants, sources, pas de temps
  config/                  # config domaine / feature flags
  lib/                     # env, domaine, SEO helpers
  i18n/                    # next-intl + sync i18next
  locales/                 # fichiers de traduction
deploy/                    # unité systemd + exemple Nginx
scripts/                   # prepare-standalone, typecheck, etc.
```

Point d'entrée runtime :

1. `app/[locale]/…` (Next) monte l'UI localisée ;
2. `MapAppEntry` bascule maintenance / carte ;
3. `App.tsx` porte l'état des filtres et orchestre hooks + carte.

Onboarding oral (90 min) : [docs/ONBOARDING.md](docs/ONBOARDING.md).

## Compatibilité des pas de temps (règle générale)

### Source de vérité

- La disponibilité des pas de temps dans l'UI est pilotée par `src/constants/sources.ts` via `supportedTimeSteps`.
- Chaque service de données doit supporter effectivement les pas annoncés (mapping, requêtage API, transformation).
- La configuration UI et l'implémentation service doivent rester alignées pour éviter les états incohérents (bouton actif mais données vides, ou inversement).

### Comportement des écrans

- Les panneaux source-spécifiques activent / désactivent les boutons selon la compatibilité de la source.
- Le panneau de comparaison applique une règle d'intersection : un pas de temps n'est activable que s'il est supporté par toutes les sources comparées.
- Un fallback automatique vers un pas valide prioritaire (`heure`, puis `quartHeure`, puis `instantane`) est appliqué si un pas courant devient invalide.

### Évolution d'un pas de temps pour une source

Pour ajouter (ou retirer) un pas de temps sur une source donnée :

1. Mettre à jour `supportedTimeSteps` dans `src/constants/sources.ts`.
2. Mettre à jour le service associé pour qu'il supporte réellement ce pas (mapping / config / requêtes).
3. Vérifier les panneaux de source et de comparaison pour confirmer l'état des boutons et le chargement des graphes.

Exemple concret : AtmoMicro n'expose pas encore `jour` côté API, donc ce pas est désactivé tant que le service ne le supporte pas.

## Déploiement production (Next.js + Nginx)

Ce projet se déploie comme une app **Next.js standalone** (process Node) derrière Nginx.
Guide détaillé : [docs/DEPLOIEMENT_NEXT.md](docs/DEPLOIEMENT_NEXT.md).

### Procédure

1. Sur la VM, placer / mettre à jour le code et le fichier `.env` (gabarit [`.env.inc`](.env.inc)). Les `NEXT_PUBLIC_*` et `NOINDEX` doivent être corrects **avant** le build.
2. Builder :

```bash
npm ci
npm run build
```

`npm run build` exécute `next build` puis [`scripts/prepare-standalone.mjs`](scripts/prepare-standalone.mjs), qui copie `public/` et `.next/static` dans `.next/standalone`. **Aucun `cp` manuel n'est nécessaire.**

3. Démarrer le process Node :

- via systemd : [`deploy/openairmap.service`](deploy/openairmap.service) (`WorkingDirectory` = racine du déploiement, `HOSTNAME=0.0.0.0`, `PORT=3000`, `EnvironmentFile` = `.env`) ;
- ou manuellement : `npm run start` (équivalent à `node .next/standalone/server.js`).

4. Reverse-proxy Nginx : exemple [`deploy/nginx-openairmap.conf.example`](deploy/nginx-openairmap.conf.example).

Après tout changement de variable `NEXT_PUBLIC_*` : rebuild + `systemctl restart openairmap`.

## Documentation complémentaire

- [Documentation technique](docs/features/DOCUMENTATION_TECHNIQUE.md)
- [Feature flags](docs/FEATURE_FLAGS.md)
- [Internationalisation](docs/INTERNATIONALISATION_I18N.md)
- [Déploiement Next.js](docs/DEPLOIEMENT_NEXT.md)
- [Onboarding animateur](docs/ONBOARDING.md)
- [Mode historique](docs/features/DOCUMENTATION_MODE_HISTORIQUE.md)
- [Intercomparaison](docs/features/DOCUMENTATION_INTERCOMPARAISON.md)
- [Feature recherche](docs/features/DOCUMENTATION_SEARCH_FEATURE.md)
- [Hook useAirQualityData](docs/features/DOCUMENTATION_USE_AIR_QUALITY_DATA.md)
- [Couches feux](docs/features/DOCUMENTATION_COUCHES_FEUX.md)
