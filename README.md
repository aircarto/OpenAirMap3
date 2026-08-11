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
- pour ajouter ou rendre optionnelle une fonctionnalite via feature flag, voir [docs/FEATURE_FLAGS.md](docs/FEATURE_FLAGS.md).

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
  "contactLabel": "Contacter l'équipe",
  "atmoMicroQualifiedSensors": {
    "enabled": true,
    "message": "Suite a un probleme technique, les donnees des capteurs qualifies ne sont plus accessibles. AtmoSud met tout en oeuvre pour le resoudre."
  }
}
```

Champs disponibles :
- `title` : titre principal de la page ;
- `message` : message explicatif principal ;
- `details` : texte court complementaire affiche sous le message ;
- `contactLabel` : libelle du bouton de contact ;
- `atmoMicroQualifiedSensors.enabled` : active/desactive le bandeau incident AtmoMicro ;
- `atmoMicroQualifiedSensors.message` : texte du bandeau incident AtmoMicro.

#### Bandeau incident AtmoMicro (mesures/dernieres)

OpenAirMap gere un mode degradé pour AtmoMicro lorsque l'endpoint `mesures/dernieres` ne fournit pas de mesures exploitables, par exemple :
- `204 No Content` ou corps vide (`null`) ;
- reponse JSON vide (`[]`) ;
- erreur reseau ou HTTP sur cet endpoint uniquement.

Comportement applique :
- un etat d'incident `atmoMicroOutage` est active dans le hook `useAirQualityData` (pour le bandeau) ;
- les capteurs listes dans `capteurs/sites` pour le polluant demande restent affiches en **marqueurs inactifs** (gris, pas de valeur recente), positions issues des metadonnees sites ;
- un bandeau d'information est affiche en haut de la carte si AtmoMicro est selectionnee ;
- le texte du bandeau provient de `public/maintenance.json` (`atmoMicroQualifiedSensors.message`) ;
- l'utilisateur peut fermer le bandeau via une croix (fermeture locale de session UI).

Fichiers concernes :
- `src/services/AtmoMicroService.ts` (fallback mesures -> sites, signal `isMeasuresUnavailableIncident`) ;
- `src/hooks/useAirQualityData.ts` (propagation de `atmoMicroOutage`) ;
- `src/App.tsx` (rendu du bandeau, texte centre, bouton de fermeture) ;
- `public/maintenance.json` (configuration du message).


Ce fichier est servi comme un fichier statique. En production, le mainteneur peut donc modifier `maintenance.json` dans les fichiers deployes sans modifier le code React. Les champs absents ou vides utilisent automatiquement le message par defaut.

Procedure type :
1. Activer `VITE_MAINTENANCE_MODE=true` dans l'environnement de build ;
2. Builder et deployer l'application ;
3. Modifier si besoin le fichier deploye `maintenance.json` pour adapter le message ;
4. Desactiver la maintenance en repassant `VITE_MAINTENANCE_MODE=false`, puis rebuilder et redeployer.

Note cache : `maintenance.json` est charge avec une strategie `no-store` cote navigateur pour faciliter les changements de message. Si un proxy, CDN ou Nginx applique un cache supplementaire, purgez ce cache ou configurez une duree courte pour ce fichier.

### Configuration domaine (`src/config/domainConfig.ts`)

Le branding, les liens institutionnels et les metadonnees SEO sont portes par `src/config/domainConfig.ts`.

Structure principale :
- `DOMAIN_CONFIG.default` contient la configuration par defaut (logo, favicon, centre/zoom/emprise de carte, titre, description, liens, organisation, mentions legales)
- `getConfigForDomain(domain)` applique la config associee au domaine courant, avec repli automatique vers `DOMAIN_CONFIG.default` si le domaine n'a pas d'entree dediee
- l'instance AtmoSud (`atmosud`) est un exemple d'entree dediee : elle est selectionnee pour tout hostname en `*.atmosud.org` (voir `isAtmoSudHost`), pas seulement une correspondance exacte — utile pour couvrir prod + preprod sans dupliquer la config.

Champs disponibles sur une entree (`DomainConfig`) :

| Champ | Usage |
|---|---|
| `logo`, `logo2`, `favicon` | Assets affiches dans le header et l'onglet du navigateur |
| `mapCenter`, `mapZoom`, `mapBounds` | Vue initiale de la carte **et** emprise reelle de l'instance (voir section Referencement) |
| `title` | Affiche dans la navbar — a garder court |
| `seoTitle` (optionnel) | Utilise pour `<title>`/`document.title` a la place de `title` si plus descriptif est souhaite sans casser l'UI |
| `description` | `<meta name="description">`, JSON-LD, et panneau "A propos" sous le header |
| `earliestMeasurementDate` (optionnel, `YYYY-MM-DD`) | Date de premiere mesure exploitable du reseau de **cette** instance, pour `temporalCoverage` (JSON-LD) — ne renseigner que si connue et verifiee, sinon laisser absent |
| `links.website/contact/about` | Liens institutionnels affiches dans l'app et les mentions legales |
| `organization` | Nom de l'entite qui opere cette instance |
| `legal` (optionnel) | Mentions legales (SIRET, forme juridique, adresse, representant legal, hebergeur, DPO...) affichees dans la modale d'information |

Pour ajouter un nouveau domaine :
1. Ajouter une entree dans `DOMAIN_CONFIG` avec une cle explicite (pas forcement le hostname exact, voir `atmosud` + `isAtmoSudHost`) ;
2. Renseigner tous les champs du tableau ci-dessus avec les vraies valeurs de l'instance (voir checklist Referencement ci-dessous) ;
3. Ajuster `getConfigForDomain` si necessaire pour que le(s) hostname(s) de cette instance y soient correctement resolus ;
4. Verifier le rendu du header, du favicon, du centrage de carte, et le panneau "A propos".

### Referencement (SEO) — checklist pour chaque instance

Plusieurs organisations deploient OpenAirMap sur des domaines differents a partir du **meme code**. Sans differenciation, ces instances servent un contenu quasiment identique et Google les traite comme des doublons : il n'en montre qu'une dans les resultats de recherche generiques, au detriment des autres (c'est ce qui est arrive a `openairmap.atmosud.org`, invisible pendant plusieurs mois face a `openairmap.fr`).

Ce que fait deja l'app **automatiquement**, sans configuration supplementaire, une fois qu'une instance a sa propre entree dans `DOMAIN_CONFIG` :
- `<link rel="canonical">` auto-referent (voir `useCanonicalUrl`) ;
- `<meta name="description">` (voir `useMetaDescription`) ;
- JSON-LD `Dataset` (voir `useStructuredData` / `structuredData.ts`), avec `spatialCoverage` derive de `mapBounds` ;
- panneau "A propos" toujours present dans le DOM, meme replie (voir `AboutPanel`), avec `description` en premier paragraphe.

Ce que **chaque instance doit renseigner elle-meme** dans `domainConfig.ts` pour que cette differenciation soit reelle (pas juste copier la config d'une autre instance) :

- [ ] **Une entree dediee dans `DOMAIN_CONFIG`** (ne pas rester sur `default`, qui est le repli generique/France) ;
- [ ] **`title`/`seoTitle`** vraiment differents des autres instances — pas juste "OpenAirMap" partout ;
- [ ] **`description`** qui decrit reellement ce que couvre *cette* instance (zone, public, source des donnees) — court, factuel, pas de bourrage de mots-cles ;
- [ ] **`mapCenter`/`mapZoom`/`mapBounds`** correspondant a la vraie zone geographique couverte par cette instance (pas la region Sud, pas la France, si ce n'est pas son perimetre) — ca alimente aussi `spatialCoverage` du JSON-LD, c'est la difference la plus difficile a confondre avec une autre instance pour Google ;
- [ ] **`organization`** = le nom reel de l'entite qui opere cette instance ;
- [ ] **`links.website/contact/about`** = les vrais liens de cette organisation, pas ceux d'AtmoSud ;
- [ ] **`legal`** = les vraies mentions legales de l'organisation qui opere l'instance (SIRET, forme juridique, adresse, representant legal, hebergeur, DPO...) — a renseigner par l'organisation elle-meme, personne d'autre ne peut le faire correctement a sa place ;
- [ ] **`earliestMeasurementDate`** (optionnel) uniquement si la date de premiere mesure exploitable du reseau de cette instance est connue et verifiee ;
- [ ] **`logo`/`logo2`/`favicon`** propres a l'instance, ajoutes dans `public/`.

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

### Overlays feux / points chauds

Le menu des fonds de carte propose aussi des couches d'incendie (independantes des sources de mesures) :

- **EFFIS** : points de chaleur 7 jours (WFS GWIS + repli WMS) + zones brulees saison (pas de cle API)
- **feuxdeforet.fr** : marqueurs de signalements (flag `VITE_ENABLE_WILDFIRE_LAYER`)

Documentation technique : [`docs/features/DOCUMENTATION_COUCHES_FEUX.md`](docs/features/DOCUMENTATION_COUCHES_FEUX.md).


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
