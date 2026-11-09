# Couches « zones » : aéroports, ports, sites Seveso

Affiche sur la carte le contour (pointillés colorés) des **aéroports**, **ports**
et **sites Seveso** de la région PACA. Survol → nom (et seuil pour le Seveso).

## D'où viennent les contours

Données **publiques et gratuites**, pré-générées dans des fichiers GeoJSON :

| Couche | Source | Couleur |
|---|---|---|
| Aéroports | OpenStreetMap (Overpass API) — `aeroway=aerodrome` | bleu |
| Ports | OpenStreetMap (Overpass API) — `harbour` / `landuse=harbour` | cyan |
| Sites Seveso | API **Géorisques** (liste officielle) × empreinte OSM `landuse=industrial` | rouge |

Pour les sites Seveso, on enrichit en plus la fiche :
- **API Recherche d'entreprises** (État, gratuite, sans clé) via le SIRET →
  secteur d'activité (NAF), année de création, catégorie (PME/ETI/GE), effectif.
- **rubriques ICPE** de Géorisques → les **activités classées** (ce que le site
  manipule : liquides/solides inflammables, produits dangereux…).
- **vue aérienne IGN** (ortho-photo, gratuite) centrée sur le site → une image
  même sans photo Wikipédia. C'est aussi le repli image pour aéroports/ports.

Pour le Seveso, Géorisques ne donne qu'un **point** par site (mais avec le statut
officiel seuil haut/bas). On croise ce point avec l'**empreinte industrielle
OpenStreetMap** qui le contient → on obtient le **contour réel de l'usine**. Les
sites sans empreinte OSM (~14 %) tombent sur un petit marqueur cerclé.

## Pourquoi des fichiers pré-générés (et pas un appel live)

Ces données sont **quasi statiques** (un aéroport/une usine ne déménage pas), et
les serveurs OpenStreetMap sont lents/limités. On les génère donc **une fois**
dans des fichiers GeoJSON, lus ensuite directement par la carte → **rapide,
fiable, aucune dépendance externe au runtime**. Rien n'est appelé chez OSM ou
Géorisques quand un visiteur ouvre le site.

### Régénérer les données

```bash
python3 scripts/generate-zones.py
```

Produit `public/data/zones/{airports,ports,seveso}.geojson` (à relancer ~1×/an
ou si un site change de statut). Le script interroge Overpass + Géorisques et
fait le croisement point-Seveso ↔ empreinte-usine.

## Architecture front

| Fichier | Rôle |
|---|---|
| `scripts/generate-zones.py` | Génération des 3 GeoJSON (Overpass + Géorisques) |
| `public/data/zones/*.geojson` | Données pré-générées servies statiquement |
| `src/constants/zones.ts` | Types, couleurs, chemins des fichiers |
| `src/services/ZonesService.ts` | Chargement paresseux + cache mémoire d'un GeoJSON |
| `src/components/map/hooks/useZonesLayer.ts` | État visibilité par type + chargement à la demande |
| `src/components/map/ZoneOverlays.tsx` | Rendu react-leaflet `<GeoJSON>` (contours pointillés, tooltip survol) |
| `src/components/controls/BaseLayerControl.tsx` | 3 cases à cocher (Aéroports / Ports / Seveso) |
| `src/components/panels/ZoneDetailPanel.tsx` | Side panel au clic : photo + description + données |
| `src/services/ZoneInfoService.ts` | Photo/description via Wikipédia (REST summary) / Wikidata |
| `src/components/map/hooks/useZoneInfo.ts` | Hook paresseux photo/description |

Détails :

- Chaque type a son **interrupteur** dans le contrôle des couches (bas-gauche).
  Le GeoJSON n'est **chargé qu'au premier affichage** du type (lazy + cache).
- Contours en **pointillés** colorés, léger surlignage + **tooltip** au survol.
- Les sites Seveso sans empreinte OSM sont rendus en **petit cercle** via
  `pointToLayer`.
- i18n complet (fr, en, es, it, de, ar) sous `zones.*`.

## Clic sur une zone -> fiche détaillée

Un clic ouvre un side panel (même chrome que la fiche bateau) avec :
- **photo + description** récupérées via les étiquettes OSM `wikipedia`/`wikidata`
  déjà stockées dans le GeoJSON (API REST Wikipédia, sans clé, CORS ouvert ;
  repli Wikidata pour l'image). Aucune photo devinée : on utilise le titre exact
  d'article fourni par OSM.
- **données** : type, codes IATA/ICAO (aéroports), classement + régime + adresse
  (Seveso), exploitant, commune, lien site web et Wikipédia, bouton recentrage.

Les aéroports sont très bien couverts par Wikipédia (44/63), les usines Seveso
beaucoup moins (8/87) — pour celles-ci la fiche reste utile via les données
Géorisques (classement, régime, adresse, site web).

## Couverture actuelle (PACA)

63 aéroports, 50 ports, 87 sites Seveso (54 seuil haut, 33 seuil bas), dont 75
avec le contour d'usine réel (Total Raffinage, Kem One, Naphtachimie…).
