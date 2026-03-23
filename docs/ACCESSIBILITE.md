# Accessibilité (a11y) – React OpenAirMap

Ce document décrit les mesures d’accessibilité mises en place et la procédure de vérification.

## Outillage

- **ESLint** : `eslint-plugin-jsx-a11y` (règles recommandées) sur les fichiers JS/JSX et TS/TSX.
- **Tests E2E** : Playwright + `@axe-core/playwright` pour détecter les violations axe (WCAG 2a/2aa) sur la page principale, la modale d’information, le side panel station (après clic sur un marqueur) et le panel mode historique.
  - Lancer les tests a11y : `npm run test:e2e:a11y`
  - Lancer tous les tests E2E : `npm run test:e2e`
  - Smoke rapide : `npm run test:e2e:smoke`
  - En cas d’erreur au lancement du navigateur (ex. librairie système manquante), installer les dépendances : `npx playwright install` puis éventuellement `npx playwright install-deps` (Linux).
- **Audit manuel** : Onglet Accessibility des DevTools (Chrome/Edge) ou extension axe DevTools.

## Procédure de test au clavier

1. **Chargement**  
   - Ouvrir l’application.  
   - Vérifier que le **premier Tab** met le focus sur le lien d’évitement « Aller au contenu principal ».  
   - Activer le lien : le focus doit passer à la zone principale (carte).

2. **Ordre de tabulation**  
   - Enchaîner les Tab : lien d’évitement → en-tête (logo, titre, menu burger ou barre d’outils) → contrôles (polluant, sources, pas de temps, modélisation, etc.) → zone carte / panneaux.  
   - Vérifier qu’aucun élément interactif n’est injoignable au clavier et que l’ordre reste logique.

3. **Modale d’information**  
   - Depuis l’en-tête, focus sur le bouton « Informations » (i) et activer (Entrée ou Espace).  
   - Le focus doit être dans la modale (bouton fermer).  
   - Tab : le focus doit rester à l’intérieur de la modale (piège au focus).  
   - **Escape** : la modale se ferme et le focus revient sur le bouton « Informations ».

4. **Menus déroulants**  
   - Ouvrir un menu (Polluant, Sources, Pas de temps, etc.) : Entrée ou Espace.  
   - Vérifier la navigation au clavier dans la liste (flèches, Entrée pour sélectionner).  
   - **Escape** : le menu se ferme.

5. **Panneaux flottants**  
   - Contrôles de lecture historique, sources spéciales, etc. : vérifier qu’ils sont focusables et que Tab/Maj+Tab les inclut dans un ordre cohérent.

## Focus visible

- Tous les éléments interactifs (boutons, liens, champs, menus) doivent afficher un **contour ou anneau visible au focus** (classes `focus:ring` / `focus-visible:ring` dans le projet).  
- Tester en naviguant au clavier uniquement (sans souris) pour confirmer la visibilité du focus.

## Checklist de vérification

- [ ] Lien d’évitement présent et fonctionnel (premier Tab, cible `#main-content`).
- [ ] Un seul `<h1>` ; hiérarchie de titres cohérente (h2, h3…) dans les panneaux et la modale.
- [ ] Modale : `role="dialog"`, `aria-modal="true"`, piège au focus, fermeture à Escape, retour du focus à l’ouverture.
- [ ] Labels de formulaire associés aux champs (`htmlFor` / `id` ou `aria-labelledby`) dans le menu mobile et les sélecteurs.
- [ ] Carte : région avec `role="region"` et `aria-label` (ex. « Carte de la qualité de l’air »).
- [ ] Contraste des textes et des composants UI (WCAG 2.1 AA : 4,5:1 pour le texte normal).
- [ ] Liens `target="_blank"` avec `rel="noopener noreferrer"`.
- [ ] Images avec `alt` pertinent ; SVG décoratifs avec `aria-hidden="true"`.
- [ ] Préférence `prefers-reduced-motion` respectée (animations réduites ou désactivées si possible ; règle globale dans `index.css`).
- [ ] Zoom navigateur à 200 % : pas de perte de contenu ni débordement horizontal non maîtrisé (tester manuellement).

## Fréquence recommandée

- **ESLint** : à chaque modification du code (lint dans la PR).
- **Tests axe Playwright** : `npm run test:e2e:a11y` avant chaque release ou dans la CI.
- **Audit manuel (clavier + DevTools)** : au moins une fois par cycle de release ou après gros refactoring UI.

## Références

- [WCAG 2.1 (FR)](https://www.w3.org/Translations/WCAG21-fr/)
- [ARIA Authoring Practices – Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
