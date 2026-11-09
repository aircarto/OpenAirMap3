# Couche de suivi des bateaux (AIS)

Affiche sur la carte la position en temps quasi réel des navires (données AIS)
avec une **traîne en fondu** derrière chaque bateau montrant d'où il vient.

## D'où viennent les données

Le système `boat-airplane-detection` (sur ce même serveur,
`/home/airlab_server5/boat-airplane-detection`) écoute AISStream.io et écrit
chaque position dans **InfluxDB**, bucket `Boat`, mesure `boat_position`
(taguée par `mmsi`). OpenAirMap **ne lit jamais InfluxDB directement** : il
consomme une route API HTTP qui fait la requête Flux et renvoie du JSON.

## Brancher la route API

Tout le branchement tient en **une variable d'environnement** :

```bash
# .env
NEXT_PUBLIC_ENABLE_BOAT_LAYER=true                              # flag (true par défaut)
NEXT_PUBLIC_BOAT_API_URL=https://api.aircarto.fr/openairmap/dataBoats
```

Tant que `NEXT_PUBLIC_BOAT_API_URL` est vide, la couche est **totalement inactive** :
aucun appel réseau, aucun élément d'interface (le toggle "Bateaux" du contrôle
de couches n'apparaît même pas).

En dev (`npm run dev`), le CORS de l'API n'autorise pas localhost:5173 : passer
par le proxy Vite `/aircarto` déjà configuré, en mettant dans `.env.local` :
`NEXT_PUBLIC_BOAT_API_URL=/aircarto/openairmap/dataBoats`.

### Contrat attendu de la route

La route existe : `openairmap/dataBoats.php` dans le dépôt api.aircarto.fr
(lecture seule du bucket InfluxDB `Boat`, CORS déjà ouvert pour openairmap.fr).
Même format que le `GET /api/tracks` de boat-airplane-detection, restreint aux
bateaux :

```
GET {NEXT_PUBLIC_BOAT_API_URL}?hours=3&every=60s
```

```json
{
  "now": 1718123456789,
  "hours": 2,
  "boats": [
    {
      "id": "244110290",
      "points": [[1718120000000, 43.251, 5.312], [1718120030000, 43.2515, 5.313]],
      "label": { "name": "MARSEILLE", "ship_type": 70 }
    }
  ]
}
```

- `id` : MMSI du navire ; `points` : `[timestamp_ms, lat, lon]` chronologiques.
- `label` est optionnel ; `label.cog` (cap) et `label.sog` (vitesse en nœuds)
  sont utilisés en priorité s'ils sont fournis, sinon le front les calcule à
  partir des deux dernières positions.
- Une réponse réduite à un simple tableau `[...]` de bateaux est aussi acceptée.

## Architecture côté front

Même pattern que la couche feux de forêt (`useWildfireLayer`) :

| Fichier | Rôle |
|---|---|
| `src/services/BoatTrackingService.ts` | Appel de la route, validation, tri, calcul cap/vitesse |
| `src/components/map/hooks/useBoatLayer.ts` | Polling (30 s), états loading/error, visibilité |
| `src/components/map/BoatTracks.tsx` | Rendu : traîne en fondu + marqueur orienté + popup |
| `src/components/map/utils/mapIconUtils.ts` | `createBoatIcon` : SVG tourné selon le cap, couleur par catégorie |
| `src/constants/boats.ts` | Réglages (intervalle, fenêtre, fondu) + catégories AIS |
| `src/config/featureFlags.ts` | Flag `boatLayer` (`NEXT_PUBLIC_ENABLE_BOAT_LAYER`) |

| `src/components/panels/BoatSidePanel.tsx` | Side panel de détails (clic sur un bateau) |
| `src/constants/mmsiCountries.ts` | Pavillon : table MID UIT → pays, drapeau emoji, nom localisé |
| `src/services/BoatInfoService.ts` | Photo + Wikipédia via Wikidata (SPARQL, par IMO) |
| `src/components/map/hooks/useBoatExternalInfo.ts` | Hook paresseux de récupération photo/liens |

### Lien avec le sélecteur de pas de temps (haut de carte)

Depuis que la feature est synchronisée au sélecteur du haut (Scan / ≤2min /
15min / Heure / Jour), chaque pas de temps choisit la profondeur du trajet et
la finesse des points. Le mapping vit dans `BOAT_TIMESTEP_CONFIG`
(`src/constants/boats.ts`) :

| Pas de temps | traîne dessinée | fenêtre chargée | finesse |
|---|---|---|---|
| Scan | **aucune** (position actuelle) | 30 min | 30 s |
| ≤2 min | 2 min | 30 min | 30 s |
| 15 min | 15 min | 30 min | 30 s |
| Heure | 1 h | 1 h | 60 s |
| Jour | 24 h | 24 h | 5 min |

La traîne **dessinée** correspond exactement au pas de temps. La fenêtre
**chargée** est découplée : pour les pas de temps courts on charge 30 min pour
garder les marqueurs stables (pas de clignotement), mais on ne dessine la
traîne que sur la durée choisie. Scan/2min/15min partagent la même requête,
donc basculer entre eux ne recharge rien.

Le front envoie `hours` ET `every` à la route ; changer le sélecteur recharge
immédiatement la couche. La route `dataBoats.php` valide `every` contre une
liste blanche (anti-injection Flux) et, s'il est absent/invalide, le choisit
automatiquement selon `hours` (rétro-compatible).

Détails de comportement :

- **Sélection** : clic sur un bateau = traîne complète mise en avant (halo
  blanc + trait épais) + side panel de détails ; les autres bateaux gardent
  une traîne courte (longueur selon le pas de temps), fine et discrète.
- **Photo du navire** : récupérée gratuitement sur Wikimedia Commons via
  Wikidata (requête SPARQL par numéro IMO, sans clé, CORS ouvert). Affichée en
  haut du panel avec crédit, + bouton « Wikipédia » quand l'article existe.
  Couvre surtout les navires notables (ferries, paquebots, gros cargos) ; pour
  les autres, repli sur les liens VesselFinder / MarineTraffic. AISStream (notre
  source AIS) ne fournit aucune photo — vérifié.
- **Side panel** (même chrome que les panels capteurs) : pavillon (déduit du
  MMSI, table UIT offline), vitesse, cap, statut de navigation AIS,
  destination, IMO, indicatif, dimensions, tirant d'eau, distance parcourue,
  et liens externes VesselFinder / MarineTraffic (photos du navire — aucune
  API gratuite de photos n'existe, on pointe vers leurs fiches publiques).

- **Traîne** : découpée en ≤ 24 tronçons d'opacité croissante — l'ancien
  s'estompe, le récent est net.
- **Couleur** = catégorie AIS du `ship_type` (cargo vert, tanker rouge,
  passagers bleu, pêche orange, plaisance violet, service teal, autre gris).
- **Marqueur** : silhouette de navire orientée selon le cap ; estompée si la
  dernière position date de plus de 30 min (transpondeur coupé / hors zone).
- **Popup** : nom (ou MMSI), type, vitesse (nœuds), cap, dernière position.
- **Toggle** utilisateur dans le contrôle de couches (en bas à gauche), avec
  le découpage communal.
- i18n complet (fr, en, es, it, de, ar) — clés sous `boats.*` et
  `baseLayer.boats`.
