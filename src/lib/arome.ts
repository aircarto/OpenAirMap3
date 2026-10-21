import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  AROME_DOMAIN_BBOX,
  AROME_DOMAIN_DEFAULT,
  AROME_DOMAIN_IDS,
  assertAromeDomain,
  type AromeDomainId,
} from '../constants/aromeDomains';

export {
  AROME_DOMAIN_BBOX,
  AROME_DOMAIN_DEFAULT,
  AROME_DOMAIN_IDS,
  aromeDomainLeafletBounds,
  assertAromeDomain,
  isAromeDomainId,
  type AromeDomainId,
} from '../constants/aromeDomains';

const DEFAULT_PYTHON =
  process.env.AROME_PYTHON?.trim() ||
  '/home/airpaca/prod_retarome/.venv/bin/python';

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'arome_extract.py');

const DEFAULT_DATA_ROOT = '/mnt/partage_stomod2/AROME_DATA';

export function getAromeDataRoot(): string {
  return process.env.AROME_DATA_ROOT?.trim() || DEFAULT_DATA_ROOT;
}

type CacheEntry = { expires: number; payload: unknown; binary?: Buffer };

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

function getCached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return null;
  }
  return hit.payload as T;
}

function setCache(key: string, payload: unknown, binary?: Buffer): void {
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, payload, binary });
}

export function getCachedBinary(key: string): Buffer | null {
  const hit = cache.get(key);
  if (!hit?.binary) return null;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return null;
  }
  return hit.binary;
}

function runPython(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(DEFAULT_PYTHON, [SCRIPT_PATH, ...args], {
      cwd: process.cwd(),
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            (stderr || stdout || `arome_extract exit ${code}`).trim()
          )
        );
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export function listAromeDomains(): {
  domains: Array<{
    id: AromeDomainId;
    bbox: [number, number, number, number];
  }>;
  dataRoot: string;
} {
  return {
    dataRoot: getAromeDataRoot(),
    domains: AROME_DOMAIN_IDS.map((id) => ({
      id,
      bbox: AROME_DOMAIN_BBOX[id],
    })),
  };
}

export async function listAromeDates(
  domain: string = AROME_DOMAIN_DEFAULT
): Promise<{ domain: string; dates: string[] }> {
  const safeDomain = assertAromeDomain(domain);
  const cacheKey = `dates:${safeDomain}`;
  const cached = getCached<{ domain: string; dates: string[] }>(cacheKey);
  if (cached) return cached;

  const { stdout } = await runPython([
    '--data-root',
    getAromeDataRoot(),
    '--domain',
    safeDomain,
    'dates',
  ]);
  const parsed = JSON.parse(stdout) as { domain: string; dates: string[] };
  setCache(cacheKey, parsed);
  return parsed;
}

export async function extractAromeWind(params: {
  date: string;
  hour: number;
  domain?: string;
}): Promise<unknown> {
  const domain = assertAromeDomain(params.domain ?? AROME_DOMAIN_DEFAULT);
  const cacheKey = `wind:${domain}:${params.date}:${params.hour}`;
  const cached = getCached<unknown>(cacheKey);
  if (cached) return cached;

  const { stdout } = await runPython([
    '--data-root',
    getAromeDataRoot(),
    '--domain',
    domain,
    'wind',
    '--date',
    params.date,
    '--hour',
    String(params.hour),
  ]);
  const parsed = JSON.parse(stdout);
  setCache(cacheKey, parsed);
  return parsed;
}

export type AromeFieldMeta = {
  var: string;
  units: string;
  bounds: [number, number, number, number];
  min: number;
  max: number;
  date: string;
  hour: number;
  domain: string;
};

export async function extractAromeField(params: {
  date: string;
  hour: number;
  var?: string;
  domain?: string;
}): Promise<{ meta: AromeFieldMeta; png: Buffer }> {
  const domain = assertAromeDomain(params.domain ?? AROME_DOMAIN_DEFAULT);
  const variable = params.var ?? 't2m';
  const cacheKey = `field:${domain}:${params.date}:${params.hour}:${variable}`;
  const cachedMeta = getCached<AromeFieldMeta>(cacheKey);
  const cachedPng = getCachedBinary(cacheKey);
  if (cachedMeta && cachedPng) {
    return { meta: cachedMeta, png: cachedPng };
  }

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'arome-'));
  const outPath = path.join(tmpDir, `${variable}.png`);
  try {
    const { stdout } = await runPython([
      '--data-root',
      getAromeDataRoot(),
      '--domain',
      domain,
      'field',
      '--date',
      params.date,
      '--hour',
      String(params.hour),
      '--var',
      variable,
      '--out',
      outPath,
    ]);
    const meta = JSON.parse(stdout) as AromeFieldMeta;
    const png = await fs.promises.readFile(outPath);
    setCache(cacheKey, meta, png);
    return { meta, png };
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

export function parseHourParam(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 23) return null;
  return n;
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
