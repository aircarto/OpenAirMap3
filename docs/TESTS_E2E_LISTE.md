# Liste détaillée des tests E2E – React OpenAirMap

Ce document décrit chaque scénario testé par la suite Playwright (end-to-end).

**Lancer les tests :** `npm run test:e2e` (tout) | `npm run test:e2e:smoke` (smoke uniquement) | `npm run test:e2e:a11y` (accessibilité uniquement).

---

## 1. Smoke et navigation (`e2e/smoke.spec.ts`)

Vérification du chargement de l’app et des zones principales.

| # | Nom du test | Ce qui est vérifié |
|---|-------------|--------------------|
| 1 | **Chargement : titre h1 et région carte visibles** | Après `goto("/")`, un titre de niveau 1 (h1) est visible ; une région avec un nom du type « carte / air / quality / map » (aria-label) est visible. Confirme que la page et la carte s’affichent. |
| 2 | **Lien d’évitement : visible et cible le contenu principal** | L’élément avec `data-testid="skip-link"` est visible ; après focus + Entrée (navigation clavier), le focus est sur `#main-content`. Vérifie l’accessibilité du lien « Aller au contenu principal ». |
| 3 | **Menu burger (viewport mobile) : ouverture et présence des sections** | En viewport 375×667 : le bouton « Menu » (aria-label) est visible ; au clic, un texte du type « Polluant / Sources / Pas de temps / time step » apparaît. Vérifie le menu mobile. |
| 4 | **Barre desktop (viewport large) : contrôles visibles** | En viewport 1280×720 : le header contient au moins un bouton visible ; un texte du type « pm / scan / heure / jour / atmo / source » est visible. Vérifie la barre de contrôles desktop. |
| 5 | **Modale information : ouverture et fermeture** | Clic sur le bouton « À propos / Informations / OpenAirMap » → une `dialog` est visible ; clic sur le bouton « Fermer / Close / … » → la dialog n’est plus visible. Vérifie le cycle d’ouverture/fermeture de la modale d’information. |

---

## 2. Contrôles header et panneaux (`e2e/controls.spec.ts`)

Ouverture/fermeture des menus du header (sans dépendre des marqueurs). Viewport : 1280×720.

| # | Nom du test | Ce qui est vérifié |
|---|-------------|--------------------|
| 1 | **Dropdown Polluant : ouverture et fermeture** | Clic sur le bouton du header dont le texte évoque le polluant (pm, scan, heure, quart, jour, 2 min, etc.) → un `role="menu"` est visible ; après Escape, le menu n’est plus visible. |
| 2 | **Dropdown Sources : ouverture et fermeture** | Clic sur le bouton du header dont le texte évoque les sources (sources, choisir, atmo, référence, etc.) → menu visible ; Escape → menu fermé. |
| 3 | **Dropdown Pas de temps : ouverture et fermeture** | Clic sur le bouton du header dont le texte évoque le pas de temps (heure, scan, quart, jour, min, etc.) → menu visible ; Escape → menu fermé. |
| 4 | **Mode historique : activation et panneau visible** | Clic sur le bouton « Mode historique / Historical mode » → un texte du type « Load data / Charger / date / période / plage » est visible. Vérifie que le panneau de configuration du mode historique s’affiche. |
| 5 | **Modélisation : ouverture du menu** | Clic sur le bouton du header dont le texte évoque la modélisation (modélisation, modeling, vent, wind, indisponible, etc.) → un menu est visible ; Escape pour fermer. |

---

## 3. Carte et side panels (`e2e/map-and-panels.spec.ts`)

Carte et panneaux latéraux ouverts au clic sur un marqueur. **Dépend des données API** : si aucun marqueur ou aucun panel n’apparaît dans le délai, le test est **ignoré** (skip).

| # | Nom du test | Ce qui est vérifié |
|---|-------------|--------------------|
| 1 | **Présence de marqueurs : au moins un après chargement** | Après chargement de la page, au moins un élément `.leaflet-marker-icon` est visible (timeout 25 s). Sinon : skip « Aucun marqueur affiché (API vide ou lente) ». |
| 2 | **Ouverture side panel station au clic sur un marqueur** | Si un marqueur est visible : clic sur le premier marqueur → apparition d’un panel (station / micro / nebuleair / SensorCommunity / PurpleAir) ou d’un titre h2 ou du texte « Chargement / Loading » (timeout 15 s). Sinon : skip. **Raisons possibles de skip :** (1) Aucun marqueur après 25 s ; (2) après le clic, aucun panel reconnu en 15 s (ordre des marqueurs dans le DOM, délai de rendu, ou type de marqueur qui n’ouvre pas un side panel). |
| 3 | **Fermeture side panel : bouton rabattre** | Si un marqueur est visible : clic marqueur → panel visible ; clic sur le bouton « Rabattre / Collapse / … » → le panel n’est plus visible. Sinon : skip. |

**Pourquoi « Ouverture side panel » peut skip :**  
(1) **Aucun marqueur** : après 25 s, aucun `.leaflet-marker-icon` n’est visible (APIs vides ou lentes).  
(2) **Panel non reconnu** : un marqueur est cliqué mais en 15 s le test ne voit aucun panel. Causes possibles : le **premier** marqueur dans le DOM n’est pas celui que vous voyez (plusieurs calques), le clic ouvre un popup au lieu d’un panel, ou le panel met plus de 15 s à s’afficher. Les panels reconnus sont : Station (AtmoRef), Micro (AtmoMicro), NebuleAir, SensorCommunity, PurpleAir (tous ont maintenant un `data-testid`).

---

## 4. Flux SignalAir et MobileAir (`e2e/signalair-mobileair.spec.ts`)

Activation des sources « spéciales » et ouverture des panels SignalAir et MobileAir. Viewport : 1280×720. **Skip** si le bouton « Sources spéciales » ou le panel attendu n’apparaît pas.

| # | Nom du test | Ce qui est vérifié |
|---|-------------|--------------------|
| 1 | **Ouvrir menu Sources spéciales puis panel SignalAir** | Clic sur le bouton « Sources spéciales / Special sources / … » → menu ou contenu Radix visible ; clic sur « SignalAir » → panel SignalAir (sélection) ou titre h2 « SignalAir / Sélection » visible (timeout 15 s). Skip si bouton ou panel absent. |
| 2 | **Panel SignalAir : sélection et bouton Charger visibles** | Après ouverture du panel SignalAir : le bouton « Charger les signalements » (ou équivalent, `data-testid="signalair-load-reports"`) est visible dans le panel (scroll si besoin, timeout 10 s). Skip si panel non affiché. |
| 3 | **Ouvrir menu Sources spéciales puis panel MobileAir** | Clic sur « Sources spéciales » puis sur « MobileAir » → panel MobileAir (sélection) ou titre h2 « MobileAir / Sélection / Capteur » visible (timeout 20 s). Skip si bouton ou panel absent. |
| 4 | **Panel MobileAir : contenu réagit (liste ou message)** | Après ouverture du panel MobileAir : le panel (testid ou zone avec h2) reste visible ; le contenu du panel (liste ou message) est présent. Skip si panel non affiché. |

---

## 5. Accessibilité (a11y) (`e2e/a11y.spec.ts`)

Vérification de l’absence de **violations critiques** axe-core (WCAG 2a / 2aa / 2.1 AA) sur les zones ciblées.

| # | Nom du test | Ce qui est vérifié |
|---|-------------|--------------------|
| 1 | **Page principale : pas de violations axe critiques** | Sur la page d’accueil (après chargement), l’analyse axe sur toute la page ne remonte aucune violation d’impact **critical**. |
| 2 | **Modale d’information : pas de violations axe critiques** | Ouverture de la modale d’information (bouton À propos / Informations) → analyse axe restreinte à `[role="dialog"]` → aucune violation critique. |
| 3 | **Side panel station : pas de violations axe critiques (si marqueur présent)** | Si au moins un marqueur est visible : clic sur le premier marqueur → panel (station / micro / nebuleair) visible → analyse axe restreinte à ce panel → aucune violation critique. Sinon : skip. |
| 4 | **Panel mode historique : pas de violations axe critiques** | Clic sur le bouton mode historique → panel `[data-testid="historical-control-panel"]` visible → analyse axe restreinte à ce panel → aucune violation critique. |

---

## 6. Recherche (`e2e/search.spec.ts`)

Contrôle de recherche (adresse / station). Viewport : 1280×720.

| # | Nom du test | Ce qui est vérifié |
|---|-------------|--------------------|
| 1 | **Ouvrir le contrôle de recherche, saisir une requête, vérifier résultats ou message** | Clic sur le bouton « Ouvrir la recherche / Open search / … » → le champ de recherche (placeholder du type « Rechercher / adresse / station / capteur ») est visible ; saisie « Paris » ; après 2 s, le champ reste visible et éditable. Vérifie que l’UI ne plante pas et que le champ reste utilisable. |

---

## 7. Gestion des erreurs – optionnel (`e2e/errors.spec.ts`)

| # | Nom du test | Ce qui est vérifié |
|---|-------------|--------------------|
| 1 | **Simulation 500 sur une API : bannière ou message d’erreur affiché** | **Actuellement toujours ignoré (skip).** À l’origine : interception de `**/api.atmosud.org/**` en 500 → chargement de la page → vérification qu’une bannière ou un texte « erreur / error » (ou `role="alert"`) s’affiche. Skip car l’app peut ne pas afficher d’erreur globale quand une seule source échoue. |

---

## Récapitulatif

| Fichier | Nombre de tests | Dépendance API / skip possible |
|---------|-----------------|---------------------------------|
| `smoke.spec.ts` | 5 | Non |
| `controls.spec.ts` | 5 | Non |
| `map-and-panels.spec.ts` | 3 | Oui (marqueurs, panel) |
| `signalair-mobileair.spec.ts` | 4 | Oui (bouton/panel selon layout) |
| `a11y.spec.ts` | 4 | 1 test dépend des marqueurs |
| `search.spec.ts` | 1 | Non |
| `errors.spec.ts` | 1 | Toujours skip |
| **Total** | **23** | 4 skips typiques en environnement sans données |

---

## Sélecteurs et data-testid utilisés

- **Lien d’évitement :** `data-testid="skip-link"`, cible `#main-content`
- **Side panels (carte) :** `data-testid="station-side-panel"`, `micro-side-panel`, `nebuleair-side-panel`
- **Panel mode historique :** `data-testid="historical-control-panel"`
- **Panel SignalAir :** `data-testid="signalair-selection-panel"`, bouton Charger `data-testid="signalair-load-reports"`
- **Panel MobileAir :** `data-testid="mobileair-selection-panel"`
- **Carte :** `role="region"` avec nom du type carte/air/quality/map
- **Modale :** `role="dialog"`

Ces identifiants sont utilisés pour stabiliser les tests et pour les analyses axe ciblées.
