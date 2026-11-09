# Capteurs mobiles MobileAir — comment un capteur devient visible

Les capteurs mobiles (parcours « MobileAir » de la source communautaire) sont
listés **dynamiquement**. OpenAirMap ne contient **aucune liste figée** de
capteurs : rien à coder côté front pour ajouter un capteur.

## D'où viennent les données

OpenAirMap **ne lit jamais InfluxDB directement**. Le front interroge deux routes
HTTP de `https://api.aircarto.fr/capteurs` (proxy Vite `/aircarto/capteurs` en dev) :

| Route | Rôle | Clé |
| --- | --- | --- |
| `GET /metadata?capteurType=MobileAir&format=JSON` | liste des capteurs + dernière position/valeur | renvoie `sensorId` **et** `sensorToken` |
| `GET /dataMobileAir?capteurID={sensorToken}&start=…&end=…&GPSnull=false&format=JSON` | points GPS des parcours | interrogée par **`sensorToken`**, pas par `sensorId` |

Chaque capteur porte **deux identifiants distincts** (voir `MobileAirSensor` dans
`src/types/index.ts`) :

- `sensorId` — l'étiquette affichée, ex. `mobileair-011`. Traitée comme une chaîne
  **opaque** : aucun `parseInt`, tri, `padStart` ni `startsWith`. Le format numérique
  (« 002 » vs « 096335 ») n'a donc **aucune** importance.
- `sensorToken` — la clé technique (`capteurID`) utilisée pour récupérer les parcours.
  Peut être totalement différente du `sensorId` (ex. `mobileair-011` → token `096335`
  parce que le capteur a changé de mode de communication).

## Checklist d'onboarding d'un nouveau capteur mobile

Pour qu'un capteur (mobileair-011, mobileair-012 à venir, …) apparaisse **et** soit
exploitable, deux conditions côté backend `api.aircarto.fr` — **zéro** modif OpenAirMap :

1. **Être listé.** Le capteur doit sortir dans `/metadata?capteurType=MobileAir` avec
   `displayMap: true` et un `sensorToken` valide. → il apparaît **automatiquement** dans
   le sélecteur MobileAir (filtre `s.displayMap` dans
   `src/components/panels/MobileAirSelectionPanel.tsx`).
2. **Avoir des parcours.** Le capteur doit pousser ses mesures GPS horodatées dans la
   source lue par `/dataMobileAir?capteurID={sensorToken}`, avec les champs :
   `time`, `sessionId`, `lat`, `lon`, `PM1`, `PM25`, `PM10`. Le front construit **une
   polyligne par `sessionId`** (`processSensorData` dans `src/services/MobileAirService.ts`) :
   sans `sessionId`, pas de trajet tracé.

> ⚠️ Piège vécu avec mobileair-011 (token `096335`) : la condition **1** était remplie
> (présent dans `metadata`, `displayMap:true`, dernière position à jour) mais pas la **2**
> — `dataMobileAir?capteurID=096335` renvoyait `[]` sur toutes les périodes. Résultat :
> le capteur apparaissait dans la liste mais aucun parcours ne s'affichait. La nouvelle
> « manière de comm' » alimentait `metadata` sans écrire dans la table de séries GPS.

## Vérifier rapidement (curl)

```bash
# 1. Le capteur est-il listé et affichable ?
curl -s "https://api.aircarto.fr/capteurs/metadata?capteurType=MobileAir&format=JSON" \
  | grep -o 'mobileair-011[^}]*displayMap":true'

# 2. Renvoie-t-il des points de parcours ? (doit être une liste NON vide)
curl -s "https://api.aircarto.fr/capteurs/dataMobileAir?capteurID=096335&start=-30d&end=now&GPSnull=false&format=JSON"

# Référence d'une réponse correcte (ancien capteur qui fonctionne) :
curl -s "https://api.aircarto.fr/capteurs/dataMobileAir?capteurID=005&start=-30d&end=now&GPSnull=true&format=JSON"
```

Si (1) est OK mais (2) renvoie `[]` → le problème est l'**ingestion des parcours GPS**
côté backend, pas OpenAirMap.
