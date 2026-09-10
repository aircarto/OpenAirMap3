#!/usr/bin/env node
/**
 * Génère le masque des sources de chaleur permanentes (torchères industrielles,
 * hauts-fourneaux, brûlage de gaz…) qui polluent la couche des points de chaleur EFFIS.
 *
 * Principe : un feu de végétation ne brûle pas au même endroit des dizaines de jours
 * répartis sur toute l'année. Une cellule détectée un grand nombre de jours DISTINCTS
 * sur 12 mois glissants est donc une source permanente, pas un incendie.
 *
 * Mesures ayant servi au calibrage (emprise France, saison 2026) :
 *   seuil  5 j → 516 cellules,  37 % des points retirés
 *   seuil 10 j → 234 cellules,  32 % des points retirés   ← coude de la courbe
 *   seuil 20 j → 143 cellules,  30 % des points retirés
 * Le rendement s'aplatit après 10 jours : on retient 10.
 *
 * Garde-fou FRP : un vrai incendie déclaré sur un site industriel doit rester visible.
 * Sur les points masqués, la puissance radiative plafonne à 134 MW (p99 = 17 MW), alors
 * que les points conservés montent à 2764 MW. Un seuil à 50 MW ne repêche que 22 points
 * sur 23 384 : le filet est quasi gratuit.
 *
 * Usage : npm run build:fire-mask [-- --threshold=10 --days=365]
 * Sortie : src/data/fireRecurrenceMask.json
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cellKey, FIRE_CELL_SIZE } from '../src/utils/fireCellKey.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GWIS_WFS_URL = 'https://maps.effis.emergency.copernicus.eu/gwis';
/** Couche « query » : même donnée que all.hs.week, mais avec frp / confidence / satellite */
const TYPENAME = 'ms:all.hs.query';

/**
 * Emprise France élargie = surensemble des mapBounds de toutes les instances
 * (voir DOMAIN_CONFIG dans src/config/domainConfig.ts). Un seul masque couvre
 * ainsi l'instance France et l'instance AtmoSud.
 */
const MASK_BOUNDS = { south: 41.3, west: -5.2, north: 51.1, east: 9.6 };

const DEFAULT_THRESHOLD_DAYS = 20;
const DEFAULT_WINDOW_DAYS = 365;
const FRP_OVERRIDE_MW = 50;

const OUTPUT_PATH = resolve(__dirname, '../src/data/fireRecurrenceMask.json');

function parseArgs() {
  const args = new Map(
    process.argv
      .slice(2)
      .filter((a) => a.startsWith('--'))
      .map((a) => {
        const [k, v] = a.slice(2).split('=');
        return [k, v ?? 'true'];
      })
  );
  const num = (key, fallback) => {
    const raw = args.get(key);
    if (raw === undefined) return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new Error(`--${key} doit être un entier positif (reçu "${raw}")`);
    }
    return parsed;
  };
  return {
    thresholdDays: num('threshold', DEFAULT_THRESHOLD_DAYS),
    windowDays: num('days', DEFAULT_WINDOW_DAYS),
  };
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Filtre OGC 1.1 : intersection de l'emprise et de la fenêtre temporelle.
 * L'ordre des coordonnées d'un Box en WFS 1.1 / EPSG:4326 est lat,lon.
 */
function buildFilter(windowStart) {
  const { south, west, north, east } = MASK_BOUNDS;
  return (
    '<Filter xmlns="http://www.opengis.net/ogc">' +
    '<And>' +
    '<BBOX><PropertyName>msGeometry</PropertyName>' +
    `<Box srsName="EPSG:4326"><coordinates>${south},${west} ${north},${east}</coordinates></Box>` +
    '</BBOX>' +
    '<PropertyIsGreaterThan><PropertyName>acq_date</PropertyName>' +
    `<Literal>${windowStart}</Literal>` +
    '</PropertyIsGreaterThan>' +
    '</And></Filter>'
  );
}

async function fetchHotspots(windowStart) {
  const url = new URL(GWIS_WFS_URL);
  url.searchParams.set('service', 'WFS');
  url.searchParams.set('version', '1.1.0');
  url.searchParams.set('request', 'GetFeature');
  url.searchParams.set('typename', TYPENAME);
  url.searchParams.set('outputformat', 'geojson');
  url.searchParams.set('filter', buildFilter(windowStart));

  // ~49 Mo / 35 s sur 12 mois : la fenêtre de timeout doit être large.
  const response = await fetch(url, { signal: AbortSignal.timeout(600_000) });
  if (!response.ok) {
    throw new Error(`WFS GWIS: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (!Array.isArray(data?.features)) {
    throw new Error('Réponse WFS inattendue : "features" absent');
  }
  return data.features;
}

function main() {
  const { thresholdDays, windowDays } = parseArgs();

  const now = new Date();
  const windowEnd = toIsoDate(now);
  const windowStart = toIsoDate(
    new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)
  );

  console.log(
    `[fire-mask] Fenêtre ${windowStart} → ${windowEnd} (${windowDays} j), seuil ${thresholdDays} j distincts`
  );
  console.log('[fire-mask] Téléchargement WFS (~49 Mo, comptez ~35 s)…');

  return fetchHotspots(windowStart).then((features) => {
    console.log(`[fire-mask] ${features.length} détections reçues`);
    if (features.length === 0) {
      throw new Error(
        'Aucune détection reçue : masque non régénéré (le fichier existant est conservé)'
      );
    }

    /** cellule → jours de détection distincts */
    const daysByCell = new Map();
    for (const feature of features) {
      const { lat, lon, acq_date: acqDate } = feature.properties ?? {};
      if (lat === undefined || lon === undefined || !acqDate) continue;
      const key = cellKey(Number.parseFloat(lat), Number.parseFloat(lon));
      let days = daysByCell.get(key);
      if (!days) {
        days = new Set();
        daysByCell.set(key, days);
      }
      days.add(acqDate);
    }

    const cells = [...daysByCell.entries()]
      .filter(([, days]) => days.size >= thresholdDays)
      .sort((a, b) => b[1].size - a[1].size)
      .map(([key]) => key);

    const masked = new Set(cells);
    const removed = features.filter((f) => {
      const { lat, lon, frp } = f.properties ?? {};
      if (lat === undefined || lon === undefined) return false;
      if (!masked.has(cellKey(Number.parseFloat(lat), Number.parseFloat(lon))))
        return false;
      return Number.parseFloat(frp ?? '0') < FRP_OVERRIDE_MW;
    }).length;

    const output = {
      // Contrat de lecture pour src/services/EffisLayerService.ts
      cellSize: FIRE_CELL_SIZE,
      thresholdDays,
      frpOverrideMw: FRP_OVERRIDE_MW,
      bounds: MASK_BOUNDS,
      generatedAt: new Date().toISOString(),
      windowStart,
      windowEnd,
      sampleSize: features.length,
      cells,
    };

    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

    const pct = ((removed / features.length) * 100).toFixed(1);
    console.log(
      `[fire-mask] ${cells.length} cellules masquées sur ${daysByCell.size} — ${removed}/${features.length} points retirés (${pct} %)`
    );
    console.log(`[fire-mask] Top 5 : ${cells.slice(0, 5).join(' · ')}`);
    console.log(`[fire-mask] Écrit dans ${OUTPUT_PATH}`);
    console.log(
      '[fire-mask] Vérifiez ces chiffres en revue : un écart marqué par rapport à la génération précédente signale une dérive.'
    );
  });
}

main().catch((error) => {
  console.error(`[fire-mask] Échec : ${error.message}`);
  process.exitCode = 1;
});
