# Audit qualite progressif - fonctionnalites principales

## Methode appliquee
- Cartographie des responsabilites et dependances pour chaque fonctionnalite cible.
- Evaluation maintenabilite: complexite, couplage, duplication, robustesse erreurs, types, testabilite.
- Priorisation des constats: critique, majeur, mineur.
- Remediation immediate sur points a risque eleve et faible risque de regression.

## Etape 1 - useAirQualityData
- **Constat majeur**: typage runtime heterogene `MeasurementDevice | SignalAirReport` traite via casts repetes.
- **Remediation appliquee**: ajout de garde-types explicites pour supprimer les casts fragiles et clarifier les branches de traitement.
- **Constat majeur**: logique de chargement multi-sources dense et difficile a verifier unitairement.
- **Backlog**: extraire la logique de planification de chargement (`sources a charger`, `regles SignalAir/MobileAir`) dans un module pur testable.

## Etape 2 - AirQualityMap
- **Constat critique**: composant tres volumineux avec orchestration de multiples sous-domaines (carte, side panels, comparaison, sources speciales).
- **Constat majeur**: forte densite de callbacks et effets, risque de regressions sur interactions croisees.
- **Backlog prioritaire**: decouper en conteneurs `MapPanelsContainer`, `MapFloatingActions`, `MapLayersAndMarkers` et stabiliser les callbacks critiques via hooks dedies.

## Etape 3 - DataServiceFactory + BaseDataService
- **Constat majeur**: factory basee sur `switch` extensible mais couteuse en maintenance.
- **Remediation appliquee**: passage a un registre declaratif `serviceConstructors` pour reduire le couplage et simplifier l'ajout de nouvelles sources.
- **Constat majeur**: duplication de la signature de fetch dans plusieurs fichiers.
- **Remediation appliquee**: introduction de types partages `DataFetchParams` et `DateRange` dans `types/index.ts`, puis reuse dans `BaseDataService` et `DataService`.

## Etapes 4 a 7 - Services AtmoRef, NebuleAir, SignalAir, MobileAir
- **AtmoRef (majeur)**: service riche mais long, plusieurs responsabilites (cache, mapping, temporal, transformation).
- **NebuleAir (majeur)**: fallback mock integre au service de prod, comportement difficile a predire en test.
- **SignalAir (majeur)**: identifiants de rapport non deterministes en fallback.
- **MobileAir (critique)**: remise a zero des routes dans la boucle capteurs, perte de donnees multi-capteurs.
- **Remediations appliquees**:
  - MobileAir: nettoyage des routes deplace hors boucle pour conserver toutes les routes selectionnees.
  - SignalAir: generation d'ID de fallback deterministe (type + coords + timestamp) pour stabilite des etats React/tests.

## Etape 8 - useTemporalVisualization
- **Constat majeur**: option `signalAirEnabled` non utilisee dans le chargement historique.
- **Remediation appliquee**: chargement SignalAir conditionne explicitement a `signalAirEnabled`.
- **Constat majeur**: complexite de fusion temporelle elevee.
- **Backlog**: extraire l'algorithme de merge/tolerance dans un utilitaire pur avec tests unitaire dedies.

## Etape 9 - Types transverses
- **Constat majeur**: centralisation utile mais fichier monolithique, evolution difficile.
- **Remediation appliquee**: premiere normalisation via `DataFetchParams` et `DateRange`.
- **Backlog**: split progressif `types/data-services.ts`, `types/temporal.ts`, `types/sources.ts` pour reduire le bruit et les conflits de merge.

## Etape 10 - Consolidation et verification
- **Lint cible fichiers modifies**: OK.
- **Tests cibles services**:
  - OK: `MobileAirService.test.ts`, `SignalAirService.test.ts`, `AtmoRefService.test.ts`, `NebuleAirService.test.ts`.
  - Realignement applique sur les tests AtmoRef/NebuleAir (mappings, gestion du cache statique, scenario de donnees obsoletes).
- **Conclusion**:
  - Les correctifs a impact direct maintenabilite/correctness ont ete appliques.
  - Le socle est pret pour une passe 2 orientee decoupage de `AirQualityMap` et reduction de la complexite des composants centraux.

## Fichiers modifies dans cette iteration
- `src/hooks/useAirQualityData.ts`
- `src/hooks/useTemporalVisualization.ts`
- `src/services/DataServiceFactory.ts`
- `src/services/BaseDataService.ts`
- `src/services/MobileAirService.ts`
- `src/services/SignalAirService.ts`
- `src/types/index.ts`
