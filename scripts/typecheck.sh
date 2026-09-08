#!/usr/bin/env bash
#
# Vérification de types ponctuelle.
#
# Le dépôt n'a pas de tsconfig : Vite/esbuild transpile le TypeScript sans le
# vérifier, et ESLint utilise le parser TS mais aucune règle typée. Rien ne
# signale donc une erreur de type — un renommage incomplet, un champ retiré d'un
# hook, un mauvais type de props passent en silence jusqu'au navigateur.
#
# Les options sont passées en ligne de commande, et les fichiers sont listés
# explicitement : `tsc` ignore alors toute recherche de tsconfig. C'est
# volontaire — déposer un tsconfig.json à la racine changerait aussi la
# transpilation de Vite (`useDefineForClassFields` suit `target`, ce qui modifie
# la sémantique des champs de classe des services), pour un bénéfice qui n'a
# rien à voir avec la vérification.
#
# `--strict false` : l'objectif est de détecter les régressions, pas de mettre
# la base au carré. En strict le bruit rendrait le signal inutilisable.
#
# Référence au 2026-09-08 : 20 erreurs préexistantes, réparties sur 8 fichiers
#   6  src/services/__tests__/SensorCommunityService.test.ts
#   6  src/components/map/MarkerWithTooltip.tsx
#   2  src/tests/fixtures/sensorCommunity.ts
#   2  src/constants/mapLayers.ts
#   1  src/services/MobileAirService.ts
#   1  src/services/CommunalLayerService.ts
#   1  src/components/controls/TemporalTimeline.tsx
#   1  src/components/controls/SourceDropdown.tsx
# Toute erreur hors de cette liste est une régression de la modification en cours.

set -uo pipefail

cd "$(dirname "$0")/.."

mapfile -t files < <(find src -name '*.ts' -o -name '*.tsx')

npx tsc \
  --noEmit \
  --jsx react-jsx \
  --esModuleInterop \
  --skipLibCheck \
  --strict false \
  --module esnext \
  --moduleResolution bundler \
  --target es2022 \
  --lib es2022,dom,dom.iterable \
  --resolveJsonModule \
  --types node,vitest/globals \
  "${files[@]}"

status=$?
if [ "$status" -eq 0 ]; then
  echo "Aucune erreur de type."
fi
exit "$status"
