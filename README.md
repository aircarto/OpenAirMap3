# OpenAirMap

Application web React/TypeScript de visualisation de la qualite de l'air sur carte interactive (Leaflet), avec filtrage par polluant, sources et pas de temps.

## Presentation rapide

OpenAirMap permet de :

- afficher des appareils de mesure sur une carte avec marqueurs thematiques 
- croiser plusieurs sources de donnees (AtmoRef, AtmoMicro, NebuleAir, PurpleAir, SensorCommunity, etc.) 
- consulter les details dans des panneaux lateraux 
- utiliser un mode historique pour rejouer des periodes passees 
- basculer de langue et adapter l'application selon le domaine (branding/config)

## Stack technique

- React 19 + TypeScript
- Vite 7
- Leaflet / React-Leaflet
- Tailwind CSS

## Prerequis

- **Node.js** : `>= 20.19.0` (recommande) ou `>= 22.12.0`
- **npm** : version recente (npm 10+ recommande)
- **Git**

La contrainte Node est alignee avec Vite 7 (`^20.19.0 || >=22.12.0`).

## Installation locale

```bash
git clone <url-du-repo>
cd OpenAirMap3
npm ci
npm run dev
```

Application disponible sur `http://localhost:5173`.

## Configuration

### Variables d'environnement

Le projet fournit un gabarit `/.env.inc`.
Copiez-le vers `.env` puis adaptez les valeurs selon votre environnement.

```bash
cp .env.inc .env
```


Notes :
- toutes les variables front doivent etre prefixees par `VITE_` ;
- `VITE_MAINTENANCE_MODE=true` affiche une page de maintenance et empeche le chargement de la carte ;
- `VITE_TOOLTIP_MIN_ZOOM` accepte un nombre (ex: `11`) ou `false` pour desactiver le seuil de zoom.

### Mode maintenance

Le mode maintenance se pilote avec le feature flag `VITE_MAINTENANCE_MODE`.
Quand il est actif, OpenAirMap affiche uniquement une page de maintenance et ne monte pas la carte Leaflet ni les appels de donnees.

Valeurs acceptees :
- actif : `true`, `1`, `on`, `yes`, `enabled` ;
- inactif : `false`, `0`, `off`, `no`, `disabled`.

Exemple :

```bash
VITE_MAINTENANCE_MODE=true
```

En developpement, redemarrez `npm run dev` apres modification du `.env`.
En production, relancez un build puis redeployez les fichiers `dist/`.

#### Personnaliser le message

Le texte affiche sur la page se configure dans `public/maintenance.json`.
Ce fichier permet au mainteneur de changer le contenu sans modifier le code React :

```json
{
  "title": "Maintenance en cours",
  "message": "La plateforme est temporairement indisponible pendant une opération de maintenance.",
  "details": "Merci de réessayer un peu plus tard.",
  "contactLabel": "Contacter l'équipe"
}
```

Champs disponibles :
- `title` : titre principal de la page ;
- `message` : message explicatif principal ;
- `details` : texte court complementaire affiche sous le message ;
- `contactLabel` : libelle du bouton de contact.

Ce fichier est servi comme un fichier statique. En production, le mainteneur peut donc modifier `maintenance.json` dans les fichiers deployes sans modifier le code React. Les champs absents ou vides utilisent automatiquement le message par defaut.

Procedure type :
1. Activer `VITE_MAINTENANCE_MODE=true` dans l'environnement de build ;
2. Builder et deployer l'application ;
3. Modifier si besoin le fichier deploye `maintenance.json` pour adapter le message ;
4. Desactiver la maintenance en repassant `VITE_MAINTENANCE_MODE=false`, puis rebuilder et redeployer.

Note cache : `maintenance.json` est charge avec une strategie `no-store` cote navigateur pour faciliter les changements de message. Si un proxy, CDN ou Nginx applique un cache supplementaire, purgez ce cache ou configurez une duree courte pour ce fichier.

### Configuration domaine (`src/config/domainConfig.ts`)

Le branding et certains liens institutionnels sont portes par `src/config/domainConfig.ts`.

Structure principale :
- `DOMAIN_CONFIG.default` contient la configuration par defaut (logo, favicon, centre/zoom de carte, titre, liens, organisation) 
- `getConfigForDomain(domain)` applique la config associee au domaine courant 
- si le domaine n'est pas defini dans `DOMAIN_CONFIG`, fallback automatique vers `DOMAIN_CONFIG.default`.

Pour ajouter un nouveau domaine :
1. Ajouter une entree dans `DOMAIN_CONFIG` avec la cle du domaine (ex: `web-prod-no2.xpr`) 
2. Renseigner `logo`, `logo2`, `favicon`, `mapCenter`, `mapZoom`, `title`, `links`, `organization` 
3. Verifier le rendu du header, du favicon et du centrage de carte.

### Fond de carte StadiaMaps

Le fond de carte par defaut (`Carte standard`) utilise StadiaMaps.

Pre-requis operationnel :
- creer un compte StadiaMaps 
- declarer dans StadiaMaps la liste des domaines autorises (whitelist), incluant le domaine de production.

Symptomes en cas de mauvaise configuration StadiaMaps :
- erreurs reseau sur les tuiles dans la console navigateur
- statut `401 Unauthorized` si le domaine courant n'est pas autorise
- fond de carte absent.

### Alternative de tuiles et procedure de bascule

Une alternative est deja integree : `Carte OSM` (OpenStreetMap), en plus de `Carte standard` (StadiaMaps) et `Satellite IGN`.

Procedure de bascule (sans redeploiement) :
1. Ouvrir le menu des couches de fond dans l'interface carte ;
2. Selectionner `Carte OSM` ;
3. Verifier que les tuiles OSM s'affichent correctement.

Cas d'usage recommande :
- utiliser `Carte OSM` comme solution de continuite si StadiaMaps renvoie des `401` (ou indisponibilite temporaire).


## Commandes utiles

```bash
npm run dev      # serveur de dev
npm run build    # build production
npm run preview  # verification locale du build
npm run lint     # verification ESLint
```

## Structure du projet (simplifiee)

```text
src/
  components/
    controls/      # menus et controles UI
    map/           # carte, marqueurs, couches
    panels/        # side panels par source
    charts/        # visualisations historiques
  services/        # acces et normalisation des donnees
  hooks/           # logique metier partagee
  constants/       # polluants, sources, pas de temps
  config/          # config domaine / feature flags
  locales/         # traductions i18n
```

## Compatibilite des pas de temps (regle generale)

### Source de verite

- La disponibilite des pas de temps dans l'UI est pilotee par `src/constants/sources.ts` via `supportedTimeSteps`.
- Chaque service de donnees doit supporter effectivement les pas annonces (mapping, requetage API, transformation).
- La configuration UI et l'implementation service doivent rester alignees pour eviter les etats incoherents (bouton actif mais donnees vides, ou inversement).

### Comportement des ecrans

- Les panneaux source-specifiques activent/desactivent les boutons selon la compatibilite de la source.
- Le panneau de comparaison applique une regle d'intersection : un pas de temps n'est activable que s'il est supporte par toutes les sources comparees.
- Un fallback automatique vers un pas valide prioritaire (`heure`, puis `quartHeure`, puis `instantane`) est applique si un pas courant devient invalide.

### Evolution d'un pas de temps pour une source

Pour ajouter (ou retirer) un pas de temps sur une source donnee :
1. Mettre a jour `supportedTimeSteps` dans `src/constants/sources.ts`.
2. Mettre a jour le service associe pour qu'il supporte reellement ce pas (mapping/config/requetes).
3. Verifier les panneaux de source et de comparaison pour confirmer l'etat des boutons et le chargement des graphes.

Exemple concret : AtmoMicro n'expose pas encore `jour` cote API, donc ce pas est desactive tant que le service ne le supporte pas.

## Deploiement production (Nginx)

Ce projet se deploie comme une SPA statique :
1) build Vite, 
2) publication des fichiers `dist/`, 
3) service par Nginx avec fallback SPA.

### 1. Build reproductible

```bash
npm ci
npm run build
```

Le build genere `dist/`.

### 2. Copier le build sur le serveur

Exemple :

```bash
rsync -avz --delete dist/ user@server:/var/www/openairmap/
```

### 3. Configuration Nginx (SPA)

Exemple de serveur Nginx (`/etc/nginx/sites-available/openairmap.conf`) :

```nginx
server {
  listen 80;
  server_name openairmap.example.org;

  root chemin-vers-dossier-build;
  index index.html;

  # Fallback SPA
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Cache long pour assets versionnes
  location ~* \.(js|mjs|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?)$ {
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
    try_files $uri =404;
  }
}
```

Activation (Debian/Ubuntu) :

```bash
sudo ln -s /etc/nginx/sites-available/openairmap.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Documentation complementaire

- [Documentation technique](docs/features/DOCUMENTATION_TECHNIQUE.md)
- [Mode historique](docs/features/DOCUMENTATION_MODE_HISTORIQUE.md)
- [Intercomparaison](docs/features/DOCUMENTATION_INTERCOMPARAISON.md)
- [Feature recherche](docs/features/DOCUMENTATION_SEARCH_FEATURE.md)
- [Hook useAirQualityData](docs/features/DOCUMENTATION_USE_AIR_QUALITY_DATA.md)
