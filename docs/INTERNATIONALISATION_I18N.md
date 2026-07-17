# Internationalisation (i18n) – OpenAirMap

L’application supporte **six langues** : **Français (fr)**, **English (en)**, **Español (es)**, **Italiano (it)**, **Deutsch (de)**, **العربية (ar)**.

## Comment ça fonctionne

### 1. Bibliothèques

- **i18next** : moteur de traduction (détection de langue, interpolation, pluriels).
- **react-i18next** : intégration React (hook `useTranslation`, re-render quand la langue change).

### 2. Fichiers de traduction

Les textes sont dans des fichiers JSON par langue :

- `src/locales/fr.json`
- `src/locales/en.json`
- `src/locales/es.json`
- `src/locales/it.json`
- `src/locales/de.json`
- `src/locales/ar.json`

Chaque fichier a la **même structure de clés**. Seules les valeurs changent.

Exemple :

```json
{
  "common": {
    "close": "Fermer",
    "loading": "Chargement..."
  },
  "app": {
    "infoButton": "Informations sur OpenAirMap"
  },
  "timeSteps": {
    "heure": "Heure",
    "jour": "Jour"
  }
}
```

### 3. Utilisation dans les composants

```tsx
import { useTranslation } from "react-i18next";

function MonComposant() {
  const { t, i18n } = useTranslation();

  return (
    <>
      <button aria-label={t("app.infoButton")}>{t("common.close")}</button>
      <p>{t("common.sourcesCount", { count: 3 })}</p>
      <p>Langue actuelle : {i18n.language}</p>
    </>
  );
}
```

- **`t("clé")`** : retourne la chaîne dans la langue courante (ex. `t("common.close")` → "Fermer" ou "Close").
- **`t("clé", { variable: valeur })`** : interpolation (ex. `t("common.sourcesCount", { count: 2 })` → "2 sources en cours").
- **Pluriels** : i18next gère avec le suffixe `_other` (ex. `sourcesCount` pour 1, `sourcesCount_other` pour 2+).

### 4. Choix de la langue

- **Au chargement** : langue enregistrée dans `localStorage` (clé `openairmap-locale`), sinon langue du navigateur si supportée, sinon français.
- **À l’usage** : le sélecteur de langue dans le header appelle `i18n.changeLanguage(code)`.
- La langue est **persistée** dans `localStorage` et l’attribut **`lang`** du `<html>` est mis à jour (accessibilité + SEO).

### 5. Configuration

Fichier : `src/i18n/index.ts`

- Liste des langues : `supportedLanguages` (fr, en, es, it, de, ar).
- Langue par défaut / fallback : `fr`.
- Pas de chargement asynchrone des traductions : tout est importé au démarrage (fichiers légers).

## Ajouter ou modifier des textes

1. **Ajouter une clé** dans les **6** fichiers `src/locales/*.json` (même clé, valeurs traduites).
2. **Utiliser la clé** dans le code : `t("namespace.maCle")`.

Convention de nommage : regroupement logique (`common`, `app`, `controls`, `timeSteps`, `quality`, `historical`, `baseLayer`, etc.).

Exemple récent : clés `baseLayer.overlayLegends*` pour le panneau de légendes des couches carte (FIRMS, EFFIS, modélisation).

## Exemple : traduire les pas de temps

Les constantes métier (codes `instantane`, `heure`, etc.) restent en français dans le code. Seuls les **libellés affichés** passent par l’i18n.

- Dans `timeSteps.ts` on garde un `name` par défaut (ou on n’affiche plus ce `name`).
- Dans l’UI on utilise : `t("timeSteps.heure")`, `t("timeSteps.jour")`, etc.

Déjà en place dans les JSON : `timeSteps.instantane`, `timeSteps.heure`, etc. Il suffit d’utiliser `t(\`timeSteps.${timeStepCode}\`)` partout où on affiche le nom du pas de temps (en veillant à ce que les codes correspondent aux clés : `quartHeure`, `deuxMin`, etc.).

## Bonnes pratiques

- Toujours fournir les **6** langues pour chaque nouvelle clé.
- Éviter le texte en dur dans les composants ; privilégier `t("...")`.
- Pour les textes longs (modales, aide), utiliser des clés dédiées (ex. `infoModal.title`, `infoModal.body`).
- Pour l’arabe (`ar`), vérifier le rendu RTL là où l’UI le gère déjà (ex. légende qualité d’air).
