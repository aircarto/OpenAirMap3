# SignalAir : quels signalements voit-on sur la carte ?

Cette page explique quels signalements SignalAir (odeurs, bruits, brûlage, visuel) sont affichés sur la carte, en temps réel comme en mode historique. Elle explique aussi ce que compte le menu Sources.

## En résumé

La carte n'affiche pas « aujourd'hui + hier ». Elle affiche les signalements dont la **nuisance déclarée chevauche le créneau sélectionné dans la TimeBar**. La règle est la même en temps réel et en mode historique, et seul le créneau change.

## 1. Période d'un signalement

Chaque signalement a une période ([`getReportPeriodInLocal`](../../src/utils/signalAirDateUtils.ts)) :

- **début** : la date déclarée de la nuisance (`signalDate`). Ce n'est pas la date de saisie du signalement ;
- **fin** : début + durée déclarée (`signalDuration`). Le flux ne renvoie pas de texte libre mais quatre catégories, que `parseSignalDuration` convertit :

| Durée déclarée | Durée retenue |
|---|---|
| « Moins d'une heure » | 1 h |
| « Quelques heures » | 3 h |
| « Plusieurs jours » | 3 jours |
| « Ne sait pas », vide ou illisible | de l'heure déclarée jusqu'à minuit le même jour (heure locale) |

Les formats numériques (« 2h », « 30 minutes », « 3 jours ») et « toute la journée » (24 h) restent lus, au cas où le formulaire évoluerait. La casse, les accents et l'apostrophe typographique (’) sont ignorés.

Un signalement sans `signalDate` valide n'est jamais affiché.

## 2. Créneau d'affichage

Le créneau dépend du pas de temps ([`getDisplayWindowInLocal`](../../src/utils/signalAirDateUtils.ts)) :

| Pas de temps | Créneau |
|---|---|
| 15 min | le quart d'heure sélectionné |
| Heure | l'heure sélectionnée |
| Jour | la journée civile entière (0 h → 23 h 59), en heure locale |

SignalAir n'est disponible qu'avec ces trois pas de temps. Au pas Scan ou 2 min, la source est désactivée.

Un signalement est affiché si sa période chevauche le créneau (`doPeriodsOverlap`, bornes strictes). Le filtre sur les types cochés dans le menu s'applique ensuite.

## 3. En temps réel

En temps réel, le créneau est **le dernier créneau terminé** (`lastCompletedSlotInstant`, [mapInstant.ts](../../src/utils/mapInstant.ts)), comme pour les mesures :

| Pas de temps | Créneau live (exemple à 15 h 20 le 27/11) |
|---|---|
| 15 min | 15 h 00 → 15 h 15 |
| Heure | 14 h → 15 h |
| Jour | **la veille**, 26/11 de 0 h à 23 h 59 |

Conséquence : une nuisance qui commence à 15 h 05 n'apparaît, au pas horaire, qu'une fois le créneau 15 h → 16 h terminé.

**Chargé ≠ affiché.** L'application charge plus de signalements qu'elle n'en affiche : 24 h en arrière pour les pas 15 min et heure, 7 jours pour le pas jour (`getLookbackDaysForTimeStep`, `buildSnapshotBufferWindow`). Cette réserve sert seulement à rendre la navigation dans la TimeBar instantanée.

**Marge de 3 jours.** Le flux sélectionne les signalements par date de *début* de nuisance, alors que l'affichage retient tout ce qui *chevauche* le créneau. Chaque requête SignalAir part donc 3 jours avant le début de la réserve, soit la durée maximale retenue pour une nuisance (`extendSignalAirFetchStart`, `SIGNAL_AIR_MAX_DURATION_DAYS`). Sans cette marge, une nuisance « Plusieurs jours » commencée avant la réserve ne serait jamais téléchargée. Le filtre d'affichage écarte ensuite tout ce qui ne chevauche pas le créneau, le compteur compris.

## 4. En mode historique

C'est la même règle, appliquée au créneau où se trouve le curseur de la TimeBar :

- au pas jour sur le 12/03 : les nuisances qui touchent le 12/03 ;
- au pas horaire sur 12/03 15 h : les nuisances en cours entre 15 h et 16 h.

La réserve chargée suit le curseur. `useInstantSnapshot` la recharge quand le curseur approche d'un bord. Si l'utilisateur a choisi une plage personnalisée, toute la plage est chargée en une fois.

## 5. Compteur du menu Sources

La ligne SignalAir affiche `n/4 · N` :

- `n/4` : le nombre de types cochés ;
- `N` : le nombre de signalements **affichés sur la carte** pour le créneau courant, après filtrage par créneau et par type (`signalAirReportsCount`, calculé sur `reportsForMap` dans `App.tsx`).

`N` n'apparaît qu'une fois le premier chargement fait.

## 6. Pièges connus

- **Pas jour en live** : le créneau live est la veille, et les signalements du jour ne sont pas chargés. L'extension de la fenêtre live jusqu'à maintenant n'est pas encore faite.
- **Mode mobilité MobileAir et prévision** : aucun signalement n'est affiché (`reportsForMap` est vide).

## Fichiers

| Rôle | Fichier |
|---|---|
| Période, créneau, filtrage | `src/utils/signalAirDateUtils.ts` |
| Créneau live, réserve chargée | `src/utils/mapInstant.ts` |
| Filtrage live et compteur | `src/App.tsx` (`reportsForMap`, `signalAirReportsCount`) |
| Filtrage en navigation | `src/hooks/useInstantSnapshot.ts` |
| Menu Sources | `src/components/controls/SignalAirSourceDisclosure.tsx` |
