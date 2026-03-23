# Stratégie de test OpenAirMap

## État de réalisation

**Les phases de tests décrites ci-dessous n'ont pas encore été réalisées.** Ce document constitue une **stratégie cible** et un **plan d'implémentation** : les outils (Vitest, Playwright, msw) et scripts (`test:run`, `test:e2e`, etc.) sont en place, mais la couverture réelle et les campagnes de tests restent à mettre en œuvre selon les phases 1 à 3.

## 1. Contexte & objectifs

OpenAirMap est une application React (Vite + TypeScript) qui agrège et visualise en temps réel des données de qualité de l’air, des signalements citoyens (SignalAir), des parcours MobileAir et des couches de modélisation (ICAiR'H, modélisation par polluant et vent). L’interface repose sur Leaflet et de multiples panneaux latéraux interactifs.

Objectifs de la stratégie :
- Sécuriser les flux de données multi-sources et leur affichage cartographique.
- Garantir la fiabilité des interactions complexes (sélections, comparaisons, modes historiques).
- Couvrir les risques critiques identifiés (régressions UI, erreurs réseau, synchronisation des états).
- Industrialiser les tests automatisés dans la CI en exploitant Vitest, Testing Library et Playwright.

## 2. Portée & priorisation

- **Critique** : `useAirQualityData`, `useTemporalVisualization`, services de données (`Atmo*`, `NebuleAir`, `SensorCommunity`, `SignalAir`), `AirQualityMap`, side panels, contrôles d’en-tête.
- **Haute** : gestion des périodes SignalAir/MobileAir, activation des couches de modélisation, mode comparaison, auto-refresh.
- **Moyenne** : modales informatives, composants purement visuels (legend, NorthArrow), contrôles secondaires (cluster/spiderfy).
- **Faible** : contenus statiques, styles Tailwind, assets.

La couverture doit rester orientée risques : focus sur les scénarios multi-sources, les basculements de mode et la résilience réseau.

## 3. Pyramide de test cible

- **Tests statiques** (lint, type-check) : run `npm run lint` + `tsc --noEmit` en pré-commit/CI.
- **Unitaires (Vitest)** : 50 % de la base critique.
- Hooks (`useAirQualityData`, `useTemporalVisualization`, `useDomainConfig`).
- Utils (`getAirQualityLevel`, générateurs de marqueurs, mapping polluants/timestep).
- Services (mock `fetch` via `msw` ou `vitest-fetch-mock` pour valider mapping & erreurs).
- **Intégration (Testing Library + msw)** : 30 %.
- `App` : sélection de sources/pas de temps, auto-refresh désactivé en mode historique.
- `AirQualityMap` : rendu des marqueurs selon sources, ouverture panels, bascule couches.
- Panneaux latéraux (SignalAir, MobileAir, StationSidePanel, MicroSidePanel) avec scénarios réalistes de props.
- **Contrats API** : mocks msw alignés sur schémas réels, tests de transformation (ex. SensorCommunity).
- **E2E (Playwright)** : 20 %.
- Scénarios nominaux (chargement initial, sélection polluant/source, affichage carte).
- Flux critiques : chargement SignalAir après sélection types + période, sélection d’un capteur MobileAir, activation mode comparaison.
- Parcours régression : bascule temps réel / historique, activation couche de vent (mock API 5 min), gestion erreurs (réponse 500 -> bannière).
- **Tests non fonctionnels** :
- Accessibilité (axe-core en CI, check Playwright `toHaveNoViolations` sur vues clés).
- Performance (profilage Lighthouse sur build, surtout bundle map et interactions modales).
- Résilience réseau (tests msw + Playwright en offline/slow 3G).

## 4. Organisation des suites

| Suite | Outils | Fréquence | Objectif |
| --- | --- | --- | --- |
| `lint` + `tsc` | ESLint, TypeScript | PR / commit | Qualité statique |
| `test:run` | Vitest | PR | Unitaire + intégration légère |
| `test:coverage` | Vitest + v8 | quotidienne / release | Suivi couverture (seuil 80 % sur modules critiques) |
| `test:e2e` | Playwright (headless) | nightly + pre-release | Scénarios bout-en-bout |
| `test:e2e:headed` | Playwright | manuelle | Debug UI |
| `test:all` | script combiné | release | Validation complète |

CI (GitHub Actions/GitLab CI) : jobs parallèles `lint`, `unit`, `e2e`. Utiliser caches `node_modules` et artéfacts (rapport coverage, rapport Playwright).

## 5. Données & mocks

- Utiliser **msw** pour simuler les sources (Atmo, SensorCommunity, SignalAir, MobileAir, Feux de Forêt).
- Générer des fixtures réalistes (réponses valides, erreurs HTTP, payloads incomplets).
- Pour Playwright :
- Démarrer app avec `vite preview`.
- Intercepter requêtes externes via `page.route` et rejouer fixtures.
- Prévoir datasets selon scénarios (ex. `signalAir_reports.json`, `mobileAir_routes.json`).
- Tests historiques : mocker horloge (`vi.setSystemTime`) pour contrôler périodes.
- Nettoyage : réinitialiser caches/`localStorage` entre tests pour éviter pollution état.

## 6. Scénarios clés à couvrir

### 6.1 Hooks & services
- `useAirQualityData`
- sélection de sources différentes -> mapping correct vers services.
- déclenchement SignalAir uniquement après `loadTrigger`.
- suppression devices MobileAir lorsque source désactivée.
- résilience réseau (erreur service, fallback état précédent).
- auto-refresh respectant `selectedTimeStep`.
- `useTemporalVisualization`
- switch mode historique -> désactivation auto-refresh.
- navigation `seekToDate`, `goToPrevious`, `goToNext` sur dataset mocké.
- `loadHistoricalData` non appelé sans `startDate/endDate`.
- Services (`SensorCommunityService`, `NebuleAirService`, `FeuxDeForetService`, etc.)
- mapping polluants / pas de temps.
- transformation -> `MeasurementDevice` avec qualité calculée.
- gestion doublons, valeurs invalides, erreur réseau.

### 6.2 Composants
- `App`
- sélection polluant incompatible -> fallback sur polluant supporté.
- sélection/désélection sources SignalAir & MobileAir -> reset états.
- ouverture InformationModal.
- `AirQualityMap`
- rendu markers selon source, icône qualité.
- ouverture/fermeture panels selon source.
- activation couche icaireh/pollutant/vent (mock WMTS/wind JSON).
- comparaison stations (ajout max 10, suppression -> sortie mode).
- interactions MobileAir (auto ouverture panel, route active, highlight point).
- Panneaux
- `SignalAirSelectionPanel` : validation boutons, chargements, communications parent.
- `MobileAirSelectionPanel` : sélection capteur -> callback.
- `MicroSidePanel` & `StationSidePanel` : chargement historique via services, affichage graphiques (mock data).

### 6.3 E2E Playwright
- **Flux principal** : Chargement page -> sélection polluant -> activation auto-refresh -> affichage loader -> marqueurs visibles.
- **SignalAir** : sélectionner source + type + période -> cliquer charger -> marqueurs `signalair` -> popup -> lien SignalAir.
- **MobileAir** : activer source -> ouverture panel -> choisir capteur -> routes rendues -> ouvrir détails -> survol point -> centrage carte.
- **Mode Historique** : activer bouton -> définir daterange -> `load data` -> vérifier slider/graph (selon UI) -> auto-refresh off.
- **Modélisation** : activer couche vent -> icône vent visible, message d’erreur si fetch 404.
- **Comparaison** : sélectionner deux stations -> activer mode comparaison -> vérifier panneau comparatif.
- **Dégradation réseau** : simuler timeout -> bannière erreur affichée -> UI dégradée mais utilisable.
- **Accessibilité rapide** : vérifier absence de violations axe sur vue principale & modale.

**Fichiers E2E (couverture progressive)** :
- `e2e/a11y.spec.ts` – accessibilité (page, modale, side panel station, panel mode historique).
- `e2e/smoke.spec.ts` – smoke et navigation (chargement, lien d’évitement, menu burger, barre desktop, modale).
- `e2e/controls.spec.ts` – contrôles header (dropdowns polluant/sources/pas de temps, mode historique, modélisation).
- `e2e/map-and-panels.spec.ts` – carte et side panels (marqueurs, ouverture/fermeture panel station) ; `test.skip()` si aucun marqueur (API vide/lente).
- `e2e/signalair-mobileair.spec.ts` – flux SignalAir et MobileAir (ouverture panels, bouton Charger) ; timeouts longs, assertions souples.
- `e2e/search.spec.ts` – recherche (ouverture, saisie, champ restant utilisable).
- `e2e/errors.spec.ts` – (optionnel) simulation 500 sur une API, vérification bannière erreur.

**Scripts** : `npm run test:e2e` (tout) ; `npm run test:e2e:smoke` (phase smoke uniquement, exécution rapide en CI) ; `npm run test:e2e:a11y` (a11y uniquement).

**Dépendance aux APIs** : Les specs carte/panels, SignalAir/MobileAir et a11y side panel dépendent des données API (marqueurs, stations). En l’absence de mock, utiliser timeouts longs (20–30 s) et `test.skip()` explicite si aucun marqueur n’apparaît.

## 7. Outils & bonnes pratiques

- **Vitest** : config `setupTests.ts` pour `msw`, `@testing-library/jest-dom`.
- **Testing Library** : privilégier interactions utilisateur (`userEvent`), requêtes par rôle/label.
- **msw** : handler par service, scénarios succès/erreur.
- **Playwright** : fixtures de contexte (mock services), screenshots diff (optionnel) pour comparaisons UI.
- **Coverage** : exporter rapport `lcov` -> badge ou suivi SonarQube.
- **Storybook (optionnel)** : isoler composants UI critiques pour tests visuels.
- **Snapshots** : limiter aux structures stables (ex. Legend) pour éviter fragilité.

## 8. Plan d’implémentation

1. **Phase 1 (Semaine 1-2)**
- Mettre en place `msw`, config Vitest globale, scripts CI.
- Couvrir hooks critiques (`useAirQualityData`, `useTemporalVisualization`).
- Tester services principaux (Atmo, SensorCommunity, NebuleAir).

2. **Phase 2 (Semaine 3-4)**
- Tests d’intégration `App` + `AirQualityMap` avec msw.
- Couvrir panneaux latéraux, SignalAir/MobileAir interactions.
- Ajouter tests accessibilité (axe) dans Vitest.

3. **Phase 3 (Semaine 5)**
- Écrire suites Playwright (scénarios listés).
- Configurer CI pour exécuter e2e sur build stable.
- Ajouter monitoring coverage + rapport Playwright.

4. **Phase continue**
- Maintenir matrix risques/tests, review lors de nouvelles fonctionnalités.
- Régression ciblée + exploration manuelle (nouveaux flux, devices réels).
- Mise à jour fixtures lors des évolutions d’API.

## 9. Tests manuels & validation terrain

- **Exploratoire UX** : vérifier comportements sur desktop/mobile, responsive panels.
- **Compatibilité** : Chrome, Firefox, Edge, Safari (desktop + iOS/Android via WebView ou PWA).
- **Tests terrain** : connecter l’application aux APIs réelles avant release (sanity check flux live).
- **Checklist release** :
- Données rafraîchies, absence d’erreurs console.
- SignalAir et MobileAir fonctionnels.
- Couche modélisation affichée ou message explicite si indisponible.
- Accessibilité clavier (navigation menus, modales).
- Internationalisation/labels cohérents (FR par défaut).

## 10. Suivi & métriques

- Couverture code (global + modules critiques).
- Temps d’exécution suites (objectif < 8 min CI).
- Nombre de bugs post-release liés à régressions.
- Détection d’incidents réseau via logs Playwright/msw.
- Résultats axe (taux de violations).

Mise à jour de la stratégie tous les trimestres ou à chaque refonte majeure (ex. ajout nouvelle source de données). Toute nouvelle fonctionnalité doit venir avec tests correspondants (unitaires + au moins un scénario e2e si flux critique).

---

Cette stratégie fournit un cadre pour renforcer la qualité d’OpenAirMap en combinant tests automatisés, validations manuelles ciblées et surveillance continue des risques.

