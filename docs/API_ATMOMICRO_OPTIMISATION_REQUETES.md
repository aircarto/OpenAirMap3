# Optimisation des requêtes AtmoMicro – Spécification pour la nouvelle API

**Objectif :** Réduire le nombre d’appels et simplifier le front en exposant une API qui regroupe les besoins réels de l’application.

---

## 1. Ce qui impose aujourd’hui plusieurs routes

L’API actuelle (`api.atmosud.org/observations/capteurs`) sépare **sites** et **mesures**, et les mesures en **dernières** vs **historique**. Le front a besoin de combiner ces morceaux pour chaque usage, ce qui multiplie les requêtes et la logique côté client.

### 1.1 Routes actuellement utilisées (résumé)

| # | Route | Méthode service | Contexte d’appel |
|---|--------|------------------|-------------------|
| 1 | `GET .../sites?format=json&actifs=2880` | `getCachedAllSites()` | Cache 30 min, utilisé par carte + variables + coords fallback |
| 2 | `GET .../sites?format=json&download=false` | `fetchSiteCoordinates()` | Fallback si pas de mesures pour un site |
| 3 | `GET .../mesures/dernieres?variable=...&aggregation=...&delais=...` | `fetchMeasures()` | **Carte** : dernières valeurs pour tous les sites |
| 4 | `GET .../mesures/dernieres?id_site=X&variable=...` | `fetchSensorTimeStep()` | **Panneau micro** : pas de temps du capteur (1 site) |
| 5 | `GET .../mesures/dernieres?id_site=X&variable=PM25...` | `fetchSiteCoordinates()` | **Panneau** : lat/lon à jour pour 1 site |
| 6 | `GET .../mesures?id_site=X&...&debut=...&fin=...` | `fetchHistoricalData()` | **Courbe détail / comparaison** : série 1 site |
| 7 | `GET .../mesures?debut=...&fin=...&variable=...&aggregation=...` (sans id_site) | `fetchTemporalDataOptimized()` | **Mode historique** : toutes mesures par tranche 30 j (N appels) |

En pratique, le front fait au minimum **2 requêtes** pour afficher la carte (sites + mesures/dernieres), puis selon les actions : **1 à N requêtes** pour variables, coords, pas de temps, historique 1 site, mode temporel.

---

## 2. Pourquoi le front doit appeler plusieurs routes

### 2.1 Données coupées entre deux ressources

- **Sites** : métadonnées (nom, lat/lon, `variables` en string, `modele_capteur`, etc.) mais **pas de valeur** ni de timestamp.
- **Mesures/dernieres** : valeur, timestamp, aggregation, (lat/lon par mesure) mais **pas** la liste des variables du site ni le modèle.

→ Pour la **carte**, le front doit **fusionner** :  
  `sites` (pour filtrer par variable et avoir noms/adresses) + `mesures/dernieres` (pour valeur, qualité, coords à jour).  
  D’où au moins **2 requêtes** par chargement (sites mis en cache 30 min pour limiter).

### 2.2 Pas d’“état complet” par site

- **Variables disponibles** : uniquement dans `sites` (string à parser).
- **Dernière valeur** : uniquement dans `mesures/dernieres`.
- **Coordonnées à jour** : dans les mesures, pas dans `sites` (qui peuvent être obsolètes).

→ Pour le **panneau détail** d’un site (variables, modèle, courbe, pas de temps, coords), le front enchaîne aujourd’hui :  
  cache sites (déjà chargé) + éventuellement `mesures/dernieres?id_site=...` (pas de temps + coords) + `mesures?id_site=...&debut=...&fin=...` (historique).  
  Plusieurs petits appels au lieu d’un “résumé site” + une série.

### 2.3 Historique : deux besoins, deux façons d’appeler

- **Un site** (courbe détail / comparaison) : `mesures?id_site=X&debut=...&fin=...`.
- **Tous les sites** (mode temporel, carte animée) : `mesures?debut=...&fin=...` **sans** `id_site`, et le front doit découper en **tranches de 30 jours** pour éviter timeouts.

→ Même ressource “mesures”, mais paramétrage et nombre d’appels différents selon le cas.

### 2.4 Pas de regroupement “dernières valeurs + métadonnées”

Une seule réponse du type “pour chaque site : métadonnées + dernière mesure pour (variable, aggregation)” n’existe pas.  
Le front construit ça lui‑même en croisant sites + mesures/dernieres, d’où la nécessité de toujours avoir **sites** (ou un équivalent) en plus des mesures.

---

## 3. Recommandations pour la nouvelle API (réduire les requêtes)

Idée directrice : **une requête par usage métier** quand c’est possible, et des réponses **auto-suffisantes** (pas besoin de rappeler une autre route pour afficher l’écran).

### 3.1 Carte (chargement initial / rafraîchissement)

**Besoin actuel :**  
liste de sites avec dernière valeur (variable + pas de temps), prête pour affichage marqueurs (id, nom, lat, lon, valeur, unité, timestamp, indicateur correction, niveau qualité).

**Proposition :**

- **Une route** du type :  
  `GET /atmomicro/map?variable=pm25&aggregation=horaire&delais=64`  
  (ou équivalent avec vos noms de paramètres.)
- **Réponse :** tableau d’objets “site + dernière mesure” déjà fusionnés, par exemple :  
  `{ id_site, nom_site, lat, lon, variable, valeur, valeur_brute, valeur_ref, unite, time, has_correction?, ... }`  
  Pas de liste “sites” séparée à fusionner côté client.

**Gain :** 2 requêtes (sites + mesures/dernieres) → **1 requête**.

### 3.2 Détail d’un site (panneau micro / comparaison)

**Besoin actuel :**  
variables disponibles (avec mapping polluant), modèle capteur, pas de temps du capteur, coordonnées à jour, puis série historique pour une variable et une période.

**Proposition :**

- **Une route “résumé site”** :  
  `GET /atmomicro/sites/{id}`  
  Contenu : métadonnées (nom, lat, lon, variables listées/normalisées, modele_capteur), **et** si possible pas de temps + dernière position (ou dernière mesure légère) pour éviter un 2ᵉ appel.
- **Une route “historique un site”** :  
  `GET /atmomicro/sites/{id}/mesures?variable=...&aggregation=...&debut=...&fin=...`  
  Réponse : série temporelle (time, value, valeur_brute, valeur_ref, etc.).

**Gain :**  
au lieu de (cache sites + fetchSiteVariables dérivé du cache + fetchSiteCoordinates + fetchSensorTimeStep + fetchHistoricalData), on vise **1** appel pour le résumé + **1** pour la courbe.  
Si pas de temps et coords sont dans le résumé, plus besoin de 2 appels “dernieres” par site.

### 3.3 Mode temporel (carte historique)

**Besoin actuel :**  
toutes les mesures (tous sites) sur une période, agrégées par timestamp, avec découpage en tranches (ex. 30 jours) pour limiter la taille des réponses.

**Proposition :**

- **Une route dédiée** :  
  `GET /atmomicro/temporal?variable=...&aggregation=...&debut=...&fin=...`  
  Côté backend : gérer les longues périodes (pagination ou streaming ou tranches côté serveur) et retourner une structure du type :  
  `{ points: [ { timestamp, devices: [ { id_site, nom_site, lat, lon, value, ... } ] } ] }`  
  ou équivalent déjà agrégé par instant.

**Gain :**  
N requêtes (tranches 30 j) → **1** (ou peu) requête(s), la logique de découpage étant côté API.

### 3.4 (Optionnel) Cache “sites” côté API

Si votre nouvelle API expose un équivalent “liste des sites” (pour filtres, recherche, etc.), prévoir que cette liste soit **enrichie** avec au moins :  
variables, modèle, et si possible dernière position ou dernier pas de temps.  
Ainsi le front n’a pas à refaire un appel “dernieres” par site pour les coords ou le pas de temps.

---

## 4. Synthèse : avant / après

| Usage | Aujourd’hui | Cible nouvelle API |
|-------|-------------|---------------------|
| Affichage carte | 2 (sites + mesures/dernieres) | **1** (map) |
| Clic sur un site (variables + modèle + coords + pas de temps) | 1 (cache) + 0 à 2 (coords, pas de temps) | **1** (résumé site) |
| Courbe détail / comparaison | 1 (historique 1 site) | **1** (sites/{id}/mesures) |
| Mode temporel | N (tranches 30 j) | **1** (temporal) ou 2–3 si pagination |

En plus : moins de logique de fusion (sites × mesures), plus de cohérence (un format par usage), et évolution du front plus simple (un appel = un écran ou un bloc d’UI).

---

## 5. Points à garder pour le front

- **Paramètres** : conserver l’équivalent de `variable` (ex. pm25, pm10), `aggregation` (brute, quart-horaire, horaire), `delais` (ou équivalent) pour que le comportement “pas de temps” reste aligné avec l’existant.
- **Formats de date** : garder un format clair pour `debut`/`fin` (ex. ISO UTC) pour historique et temporal.
- **Correction** : exposer `valeur`, `valeur_brute`, `valeur_ref` (ou noms équivalents) pour que le front puisse continuer à afficher indicateurs de correction et courbes brute/corrigée.

Si tu veux, on peut ensuite détailler un contrat d’API (exemples de requêtes/réponses) pour chaque route proposée, ou adapter le `AtmoMicroService` actuel pour qu’il appelle ta nouvelle API dès qu’elle est prête.
