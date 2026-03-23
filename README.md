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
cd Openairmap
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
- `VITE_TOOLTIP_MIN_ZOOM` accepte un nombre (ex: `11`) ou `false` pour desactiver le seuil de zoom.


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

  root /var/www/openairmap;
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


