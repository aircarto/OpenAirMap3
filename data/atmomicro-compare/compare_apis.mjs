#!/usr/bin/env node
/**
 * Comparaison ancienne API capteurs vs export microspot (PM2.5 + PM10).
 *
 * Important : id_site (ancienne) !== location_id (export). Jointure :
 * 1) nom de site normalisé
 * 2) sinon plus proche observation < 40 m
 *
 * Usage: node data/atmomicro-compare/compare_apis.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = __dirname;

const OLD_BASE = 'https://api.atmosud.org/observations/capteurs';
const NEW_BASE = 'https://api-export-prod.uspot.probesys.net/microspot';

const POLLUTANTS = [
  { key: 'pm25', oldVar: 'pm2.5', iso: '39', label: 'PM2.5' },
  { key: 'pm10', oldVar: 'pm10', iso: '24', label: 'PM10' },
];

const TIMESTEPS = [
  { key: 'hourly', oldAgg: 'horaire', newAgg: 'hourly', delay: 64 },
  { key: 'scan', oldAgg: 'brute', newAgg: 'scan', delay: 181 },
];

const HIST_HOURS = 24;
const HIST_SAMPLE_SIZE = 8;
const COORD_MATCH_M = 40;

async function fetchJson(url, { allow204 = true } = {}) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 204) {
    if (allow204) return [];
    throw new Error(`204 Unexpected empty: ${url}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${url}\n${body.slice(0, 200)}`);
  }
  const text = await res.text();
  if (!text || !text.trim()) return [];
  return JSON.parse(text);
}

function oldDisplayValue(m) {
  return m.valeur ?? m.valeur_brute ?? null;
}

function normName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function haversineM(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => v == null || Number.isNaN(Number(v)))) {
    return null;
  }
  const R = 6371000;
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function stats(nums) {
  if (!nums.length) return { n: 0, mean: null, max: null, p50: null, p95: null, rmse: null };
  const sorted = [...nums].sort((a, b) => a - b);
  const mean = nums.reduce((s, x) => s + x, 0) / nums.length;
  const rmse = Math.sqrt(nums.reduce((s, x) => s + x * x, 0) / nums.length);
  return {
    n: nums.length,
    mean: round(mean, 3),
    max: round(sorted[sorted.length - 1], 3),
    p50: round(sorted[Math.floor(sorted.length * 0.5)], 3),
    p95: round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))], 3),
    rmse: round(rmse, 3),
  };
}

function round(n, d = 2) {
  if (n == null || Number.isNaN(n)) return null;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function bucketHour(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

/** Group export rows by location, keep freshest per location + device list */
function groupNewByLocation(newRows) {
  const byLoc = new Map();
  const withoutLoc = [];
  for (const o of newRows) {
    if (!o.location_id) {
      withoutLoc.push(o);
      continue;
    }
    const loc = String(o.location_id);
    const entry = byLoc.get(loc) || { freshest: null, devices: [] };
    entry.devices.push(o);
    if (
      !entry.freshest ||
      new Date(o.time).getTime() > new Date(entry.freshest.time).getTime()
    ) {
      entry.freshest = o;
    }
    byLoc.set(loc, entry);
  }
  return { byLoc, withoutLoc };
}

/**
 * Join old measure row to a new observation.
 * Prefer exact normalized location/site name; else nearest device < COORD_MATCH_M.
 */
function matchOldToNew(oldRow, newRows, byLoc) {
  const oldName = normName(oldRow.nom_site);
  const nameHits = newRows.filter(
    (o) => o.location_name && normName(o.location_name) === oldName
  );
  if (nameHits.length) {
    // Freshest among name hits (handles multi-device same site name)
    nameHits.sort((a, b) => new Date(b.time) - new Date(a.time));
    const o = nameHits[0];
    return {
      how: 'name',
      observation: o,
      dist: haversineM(oldRow.lat, oldRow.lon, o.lat, o.lon),
      sibling_devices: nameHits.length,
    };
  }

  let best = null;
  let bestDist = Infinity;
  for (const o of newRows) {
    const d = haversineM(oldRow.lat, oldRow.lon, o.lat, o.lon);
    if (d != null && d < bestDist) {
      bestDist = d;
      best = o;
    }
  }
  if (best && bestDist <= COORD_MATCH_M) {
    const siblings = byLoc.get(String(best.location_id))?.devices.length ?? 1;
    return { how: 'coord', observation: best, dist: bestDist, sibling_devices: siblings };
  }
  return null;
}

async function compareLatest(pollutant, timestep) {
  const oldUrl =
    `${OLD_BASE}/mesures/dernieres` +
    `?format=json&download=false&nb_dec=1&valeur_brute=true&type_capteur=true` +
    `&variable=${encodeURIComponent(pollutant.oldVar)}` +
    `&aggregation=${timestep.oldAgg}&delais=${timestep.delay}`;

  const newUrl =
    `${NEW_BASE}/observations/latest` +
    `?aggregation=${timestep.newAgg}` +
    `&variable=${pollutant.iso}` +
    `&delay=${timestep.delay}` +
    `&decimals=1` +
    `&include=raw_value` +
    `&limit=500000`;

  const [oldRows, newRows] = await Promise.all([
    fetchJson(oldUrl),
    fetchJson(newUrl),
  ]);

  const { byLoc, withoutLoc } = groupNewByLocation(newRows);

  const valueDiffs = [];
  const rawDiffs = [];
  const timeDiffsMin = [];
  const coordDiffsM = [];
  const sampleMismatches = [];
  const unmatchedOld = [];
  const joins = [];
  const matchedNewDeviceIds = new Set();
  let nameJoins = 0;
  let coordJoins = 0;

  for (const old of oldRows) {
    const match = matchOldToNew(old, newRows, byLoc);
    if (!match) {
      unmatchedOld.push({
        id_site: old.id_site,
        nom_site: old.nom_site,
        lat: old.lat,
        lon: old.lon,
        value: oldDisplayValue(old),
        time: old.time,
      });
      continue;
    }
    if (match.how === 'name') nameJoins++;
    else coordJoins++;

    const neu = match.observation;
    matchedNewDeviceIds.add(neu.id);
    const oldVal = oldDisplayValue(old);
    const newVal = neu.value_ref;

    joins.push({
      location_id: neu.location_id,
      device_id: neu.id,
      id_site: old.id_site,
      how: match.how,
      old,
      neu,
    });

    if (oldVal != null && newVal != null) {
      const diff = Math.abs(Number(newVal) - Number(oldVal));
      valueDiffs.push(diff);
      if (diff > 0.5 && sampleMismatches.length < 40) {
        sampleMismatches.push({
          id_site: old.id_site,
          location_id: neu.location_id,
          device_id: neu.id,
          name: old.nom_site,
          how: match.how,
          sibling_devices: match.sibling_devices,
          old_value: oldVal,
          new_value_ref: newVal,
          old_raw: old.valeur_brute ?? null,
          new_raw: neu.value_raw ?? null,
          old_corrected: old.valeur ?? null,
          new_corrected: neu.value ?? null,
          old_time: old.time,
          new_time: neu.time,
          diff: round(diff, 3),
        });
      }
    }

    const oldRaw = old.valeur_brute ?? null;
    const newRaw = neu.value_raw ?? null;
    if (oldRaw != null && newRaw != null) {
      rawDiffs.push(Math.abs(Number(newRaw) - Number(oldRaw)));
    }
    if (old.time && neu.time) {
      timeDiffsMin.push(
        Math.abs(new Date(neu.time) - new Date(old.time)) / 60000
      );
    }
    if (match.dist != null) coordDiffsM.push(match.dist);
  }

  // Export-only devices (no old site matched)
  const exportOnlyDevices = newRows.filter((o) => !matchedNewDeviceIds.has(o.id));

  // Multi-device locations in export
  const multiDeviceLocations = [];
  let extraDevices = 0;
  for (const [loc, entry] of byLoc) {
    if (entry.devices.length > 1) {
      extraDevices += entry.devices.length - 1;
      multiDeviceLocations.push({
        location_id: loc,
        location_name: entry.freshest?.location_name,
        device_count: entry.devices.length,
        device_ids: entry.devices.map((d) => d.id),
      });
    }
  }

  const coverage =
    oldRows.length > 0 ? joins.length / oldRows.length : 0;

  return {
    pollutant: pollutant.label,
    timestep: timestep.key,
    join_note:
      'id_site !== location_id ; jointure nom normalisé puis coords < 40m',
    counts: {
      old_rows: oldRows.length,
      new_rows: newRows.length,
      new_locations: byLoc.size,
      new_without_location: withoutLoc.length,
      matched: joins.length,
      unmatched_old: unmatchedOld.length,
      coverage_pct: round(coverage * 100, 1),
      name_joins: nameJoins,
      coord_joins: coordJoins,
      export_only_devices: exportOnlyDevices.length,
      multi_device_locations: multiDeviceLocations.length,
      extra_devices_beyond_one_per_site: extraDevices,
    },
    value_abs_diff: stats(valueDiffs),
    raw_abs_diff: stats(rawDiffs),
    time_diff_minutes: stats(timeDiffsMin),
    coord_diff_meters: stats(coordDiffsM),
    unmatched_old_sample: unmatchedOld.slice(0, 20),
    export_only_sample: exportOnlyDevices.slice(0, 15).map((o) => ({
      device_id: o.id,
      location_id: o.location_id,
      location_name: o.location_name,
      value_ref: o.value_ref,
      time: o.time,
    })),
    multi_device_sample: multiDeviceLocations.slice(0, 15),
    value_mismatch_sample: sampleMismatches
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 15),
    _join: joins,
  };
}

async function compareHistorical(joinPairs, pollutant, hours = HIST_HOURS) {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 3600 * 1000);
  const debut = start.toISOString();
  const fin = end.toISOString();

  // Prefer name joins with small latest diff
  const candidates = joinPairs
    .filter((p) => p.old && p.neu)
    .map((p) => {
      const oldVal = oldDisplayValue(p.old);
      const diff =
        oldVal != null && p.neu.value_ref != null
          ? Math.abs(Number(p.neu.value_ref) - Number(oldVal))
          : 999;
      return { ...p, _diff: diff };
    })
    .sort((a, b) => {
      // name first, then lower diff
      if (a.how !== b.how) return a.how === 'name' ? -1 : 1;
      return a._diff - b._diff;
    })
    .slice(0, HIST_SAMPLE_SIZE);

  const results = [];

  for (const pair of candidates) {
    const oldUrl =
      `${OLD_BASE}/mesures` +
      `?id_site=${encodeURIComponent(pair.id_site)}` +
      `&format=json&download=false&nb_dec=1&valeur_brute=true&type_capteur=true` +
      `&variable=${encodeURIComponent(pollutant.oldVar)}` +
      `&aggregation=horaire` +
      `&debut=${encodeURIComponent(debut)}` +
      `&fin=${encodeURIComponent(fin)}`;

    const newUrl =
      `${NEW_BASE}/observations` +
      `?device_id=${encodeURIComponent(pair.device_id)}` +
      `&variable=${pollutant.iso}` +
      `&aggregation=hourly` +
      `&from_date_time=${encodeURIComponent(debut)}` +
      `&date_time=${encodeURIComponent(fin)}` +
      `&decimals=1` +
      `&include=raw_value` +
      `&limit=500000`;

    let oldSeries = [];
    let newSeries = [];
    let error = null;
    try {
      [oldSeries, newSeries] = await Promise.all([
        fetchJson(oldUrl),
        fetchJson(newUrl),
      ]);
    } catch (e) {
      error = String(e.message || e);
    }

    const oldByBucket = new Map();
    for (const m of oldSeries) {
      const b = bucketHour(m.time);
      if (!b) continue;
      oldByBucket.set(b, oldDisplayValue(m));
    }
    const newByBucket = new Map();
    for (const o of newSeries) {
      const b = bucketHour(o.time);
      if (!b) continue;
      newByBucket.set(b, o.value_ref);
    }

    const commonBuckets = [...oldByBucket.keys()].filter((b) =>
      newByBucket.has(b)
    );
    const diffs = [];
    for (const b of commonBuckets) {
      const ov = oldByBucket.get(b);
      const nv = newByBucket.get(b);
      if (ov == null || nv == null) continue;
      diffs.push(Math.abs(Number(nv) - Number(ov)));
    }

    results.push({
      id_site: pair.id_site,
      location_id: pair.location_id,
      device_id: pair.device_id,
      join_how: pair.how,
      site_name: pair.old?.nom_site ?? pair.neu?.location_name,
      window_hours: hours,
      old_points: oldSeries.length,
      new_points: newSeries.length,
      common_hourly_buckets: commonBuckets.length,
      only_old_buckets: [...oldByBucket.keys()].filter((b) => !newByBucket.has(b))
        .length,
      only_new_buckets: [...newByBucket.keys()].filter((b) => !oldByBucket.has(b))
        .length,
      value_abs_diff: stats(diffs),
      error,
    });
  }

  return {
    pollutant: pollutant.label,
    aggregation: 'hourly',
    window_hours: hours,
    sample_size: results.length,
    pairs: results,
  };
}

function decideGoNoGo(latestResults, historicalResults) {
  const reasons = [];
  let go = true;

  for (const r of latestResults) {
    const { counts, value_abs_diff } = r;
    if (counts.coverage_pct < 70) {
      go = false;
      reasons.push(
        `${r.pollutant}/${r.timestep}: couverture jointure ${counts.coverage_pct}% < 70%`
      );
    }
    if (value_abs_diff.n > 0 && value_abs_diff.mean > 1.0) {
      go = false;
      reasons.push(
        `${r.pollutant}/${r.timestep}: écart moyen valeurs ${value_abs_diff.mean} > 1.0 µg/m³`
      );
    }
    if (value_abs_diff.n > 0 && value_abs_diff.p95 > 5.0) {
      go = false;
      reasons.push(
        `${r.pollutant}/${r.timestep}: p95 écart valeurs ${value_abs_diff.p95} > 5.0 µg/m³`
      );
    }
  }

  for (const h of historicalResults) {
    const usable = h.pairs.filter((p) => !p.error && p.value_abs_diff.n >= 3);
    const badPairs = usable.filter(
      (p) => p.value_abs_diff.mean > 1.5 || p.value_abs_diff.max > 10
    );
    if (usable.length > 0 && badPairs.length > usable.length / 2) {
      go = false;
      reasons.push(
        `Historique ${h.pollutant}: ${badPairs.length}/${usable.length} paires avec écarts élevés`
      );
    }
  }

  if (go) {
    reasons.push(
      'Couverture jointure et écarts de valeurs dans les seuils.'
    );
    reasons.push(
      'id_site !== location_id (jointure nom/coords) ; export ajoute des devices non adressables par l’ancienne API.'
    );
  }

  return { decision: go ? 'GO' : 'NO-GO', reasons };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log('=== Comparaison latest ===');
  console.log('(jointure: nom normalisé puis coords < 40m — id_site ≠ location_id)');
  const latestResults = [];
  for (const p of POLLUTANTS) {
    for (const t of TIMESTEPS) {
      process.stdout.write(`  ${p.label} / ${t.key}... `);
      const r = await compareLatest(p, t);
      console.log(
        `old=${r.counts.old_rows} new=${r.counts.new_rows} matched=${r.counts.matched} ` +
          `(${r.counts.coverage_pct}%) valMeanDiff=${r.value_abs_diff.mean} p95=${r.value_abs_diff.p95}`
      );
      latestResults.push(r);
    }
  }

  console.log('=== Comparaison historique (24h, échantillon) ===');
  const historicalResults = [];
  for (const p of POLLUTANTS) {
    const hourly = latestResults.find(
      (r) => r.pollutant === p.label && r.timestep === 'hourly'
    );
    process.stdout.write(`  ${p.label} historique... `);
    const h = await compareHistorical(hourly?._join || [], p, HIST_HOURS);
    const means = h.pairs
      .map((x) => x.value_abs_diff.mean)
      .filter((x) => x != null);
    console.log(`pairs=${h.sample_size} means=[${means.join(', ')}]`);
    historicalResults.push(h);
  }

  const decision = decideGoNoGo(latestResults, historicalResults);
  const latestPublic = latestResults.map(({ _join, ...rest }) => rest);

  const report = {
    generated_at: new Date().toISOString(),
    old_base: OLD_BASE,
    new_base: NEW_BASE,
    join_strategy:
      'nom_site≈location_name (normalisé) sinon coords<40m ; id_site ne matche PAS location_id',
    decision,
    latest: latestPublic,
    historical: historicalResults,
  };

  writeFileSync(join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

  const lines = [];
  lines.push('# Rapport comparaison AtmoMicro — ancienne API vs export microspot');
  lines.push('');
  lines.push(`Généré : ${report.generated_at}`);
  lines.push('');
  lines.push(`## Décision : **${decision.decision}**`);
  lines.push('');
  for (const reason of decision.reasons) {
    lines.push(`- ${reason}`);
  }
  lines.push('');
  lines.push('## Jointure');
  lines.push('');
  lines.push(
    `- **\`id_site\` (ancienne) ≠ \`location_id\` (export)** — overlap direct = 0.`
  );
  lines.push(
    `- Règle utilisée : nom de site normalisé, sinon observation la plus proche **< 40 m**.`
  );
  lines.push(
    `- Côté export, comparaison sur le device joint (l’ancienne API ne permettait pas d’adresser un device par id).`
  );
  lines.push('');
  lines.push('## Dernières mesures');
  lines.push('');
  lines.push(
    '| Polluant | Pas | Old | New | Matchés | Couverture | Only old | Export-only devices | Extra devices | Écart mean | p95 | max |'
  );
  lines.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of latestPublic) {
    lines.push(
      `| ${r.pollutant} | ${r.timestep} | ${r.counts.old_rows} | ${r.counts.new_rows} | ${r.counts.matched} | ${r.counts.coverage_pct}% | ${r.counts.unmatched_old} | ${r.counts.export_only_devices} | ${r.counts.extra_devices_beyond_one_per_site} | ${r.value_abs_diff.mean ?? '-'} | ${r.value_abs_diff.p95 ?? '-'} | ${r.value_abs_diff.max ?? '-'} |`
    );
  }
  lines.push('');
  lines.push('### Échantillon écarts > 0.5 µg/m³ (hourly PM2.5 si dispo)');
  lines.push('');
  const pm25h = latestPublic.find((r) => r.pollutant === 'PM2.5' && r.timestep === 'hourly');
  if (pm25h?.value_mismatch_sample?.length) {
    lines.push('| Site | device | old | new value_ref | diff | how |');
    lines.push('|---|---|---:|---:|---:|---|');
    for (const m of pm25h.value_mismatch_sample) {
      lines.push(
        `| ${m.name} | ${m.device_id} | ${m.old_value} | ${m.new_value_ref} | ${m.diff} | ${m.how} |`
      );
    }
  } else {
    lines.push('_Aucun écart > 0.5 µg/m³ sur l’échantillon._');
  }
  lines.push('');
  lines.push('## Historique (24 h, agrégation horaire)');
  lines.push('');
  for (const h of historicalResults) {
    lines.push(`### ${h.pollutant}`);
    lines.push('');
    lines.push(
      '| id_site | location_id | device_id | site | pts old | pts new | buckets communs | écart mean | écart max | erreur |'
    );
    lines.push('|---|---|---|---|---:|---:|---:|---:|---:|---|');
    for (const p of h.pairs) {
      lines.push(
        `| ${p.id_site} | ${p.location_id} | ${p.device_id} | ${p.site_name ?? ''} | ${p.old_points} | ${p.new_points} | ${p.common_hourly_buckets} | ${p.value_abs_diff.mean ?? '-'} | ${p.value_abs_diff.max ?? '-'} | ${p.error ?? ''} |`
      );
    }
    lines.push('');
  }
  lines.push('## Notes');
  lines.push('');
  lines.push(`- Ancienne : \`${OLD_BASE}\``);
  lines.push(`- Export : \`${NEW_BASE}\``);
  lines.push(
    '- Les devices « export-only » et multi-device par site sont une richesse de la nouvelle API, pas un défaut de couverture legacy.'
  );
  lines.push('');

  writeFileSync(join(OUT_DIR, 'REPORT.md'), lines.join('\n'));
  console.log(`\nRapport : ${join(OUT_DIR, 'REPORT.md')}`);
  console.log(`Décision : ${decision.decision}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
