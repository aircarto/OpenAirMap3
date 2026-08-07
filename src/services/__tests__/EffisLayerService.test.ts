import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildHotspotsFilter,
  formatWfsDateTime,
  getHotspotRadius,
  isPermanentSource,
  resolveBurnedAreasTypename,
  isWithinHotspotsRetention,
  getHotspotsRetentionStart,
  createEffisHotspotsGeoJSONLayer,
  clearHotspotsDayCache,
  EFFIS_HOTSPOTS_RETENTION_DAYS,
} from '../EffisLayerService';
import { cellKey } from '../../utils/fireCellKey.mjs';
import recurrenceMask from '../../data/fireRecurrenceMask.json';
import { DomainConfig } from '../../config/domainConfig';

/** Emprise AtmoSud (cf. DOMAIN_CONFIG.atmosud.mapBounds) */
const PACA_BOUNDS: DomainConfig['mapBounds'] = [
  [42.85, 4.0],
  [45.25, 7.95],
];

describe('formatWfsDateTime', () => {
  it("formate en UTC, pas en heure locale", () => {
    // `acq_at` est horodaté en UTC côté EFFIS : formater en local décalerait la
    // fenêtre de 1 à 2 h en France et amputerait les détections les plus récentes.
    const date = new Date('2026-08-06T03:51:00.000Z');
    expect(formatWfsDateTime(date)).toBe('2026-08-06 03:51:00');
  });

  it('produit le format exact attendu par MapServer', () => {
    expect(formatWfsDateTime(new Date('2026-01-02T00:00:00Z'))).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
    );
  });
});

describe('buildHotspotsFilter', () => {
  it("n'impose qu'une borne basse en temps réel", () => {
    // Une borne haute calée sur l'horloge du navigateur masquerait les détections
    // arrivées pendant un décalage d'horloge.
    const filter = buildHotspotsFilter(PACA_BOUNDS, '24h');
    expect(filter).toContain('<PropertyIsGreaterThan>');
    expect(filter).not.toContain('<PropertyIsBetween>');
  });

  it('encadre la fenêtre des deux côtés en mode historique', () => {
    const reference = new Date('2026-07-15T12:00:00Z');
    const filter = buildHotspotsFilter(PACA_BOUNDS, '24h', reference);
    expect(filter).toContain('<PropertyIsBetween>');
    expect(filter).toContain(
      '<LowerBoundary><Literal>2026-07-14 12:00:00</Literal></LowerBoundary>'
    );
    expect(filter).toContain(
      '<UpperBoundary><Literal>2026-07-15 12:00:00</Literal></UpperBoundary>'
    );
  });

  it('recule de 7 jours pour la période 7d', () => {
    const reference = new Date('2026-07-15T12:00:00Z');
    const filter = buildHotspotsFilter(PACA_BOUNDS, '7d', reference);
    expect(filter).toContain(
      '<LowerBoundary><Literal>2026-07-08 12:00:00</Literal></LowerBoundary>'
    );
  });

  it("émet les coordonnées dans l'ordre lat,lon exigé par WFS 1.1", () => {
    // En WFS 1.1 / EPSG:4326 l'ordre est lat,lon — l'inverser renverrait
    // silencieusement zéro résultat plutôt qu'une erreur.
    const filter = buildHotspotsFilter(PACA_BOUNDS, '24h');
    expect(filter).toContain('<coordinates>42.85,4 45.25,7.95</coordinates>');
  });

  it('cible bien le champ acq_at et non acq_date', () => {
    // acq_date n'a qu'une précision au jour : la fenêtre 24 h serait fausse.
    const filter = buildHotspotsFilter(PACA_BOUNDS, '24h');
    expect(filter).toContain('<PropertyName>acq_at</PropertyName>');
    expect(filter).not.toContain('<PropertyName>acq_date</PropertyName>');
  });
});

describe('resolveBurnedAreasTypename', () => {
  it('utilise les couches relatives en temps réel', () => {
    expect(resolveBurnedAreasTypename('today')).toBe('ms:modis.ba.poly.today');
    expect(resolveBurnedAreasTypename('week')).toBe('ms:modis.ba.poly.week');
    expect(resolveBurnedAreasTypename('season')).toBe('ms:modis.ba.poly.season');
  });

  it("bascule sur l'archive annuelle pour une année révolue", () => {
    // Les couches today/week/season sont relatives à aujourd'hui : elles ne
    // contiennent rien pour une date passée.
    expect(resolveBurnedAreasTypename('season', new Date('2022-07-15Z'))).toBe(
      'ms:modis.ba.poly.2022'
    );
  });

  it("reste sur les couches relatives pour l'année en cours", () => {
    const thisYear = new Date();
    expect(resolveBurnedAreasTypename('week', thisYear)).toBe(
      'ms:modis.ba.poly.week'
    );
  });

  it("borne à la première année archivée", () => {
    expect(resolveBurnedAreasTypename('season', new Date('2009-07-15Z'))).toBe(
      'ms:modis.ba.poly.2016'
    );
  });
});

describe('getHotspotRadius', () => {
  it('croît avec la puissance radiative', () => {
    const radii = [1, 10, 100, 1000].map((frp) => getHotspotRadius(String(frp)));
    for (let i = 1; i < radii.length; i += 1) {
      expect(radii[i]).toBeGreaterThan(radii[i - 1]);
    }
  });

  it('reste borné sur toute la plage observée (0,2 à 2764 MW)', () => {
    for (const frp of ['0.2', '5.2', '480.7', '2764.1']) {
      const radius = getHotspotRadius(frp);
      expect(radius).toBeGreaterThanOrEqual(4);
      expect(radius).toBeLessThanOrEqual(14);
    }
  });

  it('retombe sur le rayon minimal si le FRP est absent ou invalide', () => {
    expect(getHotspotRadius(undefined)).toBe(4);
    expect(getHotspotRadius('')).toBe(4);
    expect(getHotspotRadius('0')).toBe(4);
  });
});

describe('isPermanentSource', () => {
  /** Cellule réellement présente dans le masque : torchères de Fos-sur-Mer */
  const maskedCell = recurrenceMask.cells[0];
  const [maskedLat, maskedLon] = maskedCell.split(',');

  it('écarte un point situé dans une cellule masquée', () => {
    expect(
      isPermanentSource({ lat: maskedLat, lon: maskedLon, frp: '2.3' })
    ).toBe(true);
  });

  it('conserve un point hors cellule masquée', () => {
    // Plein Verdon, loin de tout site industriel
    expect(isPermanentSource({ lat: '43.79', lon: '6.32', frp: '2.3' })).toBe(
      false
    );
  });

  it('conserve un point à FRP élevé même en cellule masquée', () => {
    // Garde-fou : un incendie réel déclaré sur un site industriel doit rester visible.
    expect(
      isPermanentSource({
        lat: maskedLat,
        lon: maskedLon,
        frp: String(recurrenceMask.frpOverrideMw + 1),
      })
    ).toBe(false);
  });

  it('applique le masque au seuil exact de FRP', () => {
    expect(
      isPermanentSource({
        lat: maskedLat,
        lon: maskedLon,
        frp: String(recurrenceMask.frpOverrideMw),
      })
    ).toBe(false);
  });

  it('ne masque pas un point sans coordonnées exploitables', () => {
    expect(isPermanentSource({ frp: '2.3' })).toBe(false);
    expect(isPermanentSource({ lat: 'n/a', lon: 'n/a', frp: '2.3' })).toBe(
      false
    );
  });
});

describe('masque de récurrence', () => {
  it('est cohérent avec la fonction de clé partagée', () => {
    // Le masque est calculé hors ligne par scripts/build-fire-mask.mjs : si la clé
    // divergeait entre le script et le runtime, le masque deviendrait inopérant
    // sans qu'aucune erreur ne soit levée.
    for (const key of recurrenceMask.cells.slice(0, 20)) {
      const [lat, lon] = key.split(',').map(Number);
      expect(cellKey(lat, lon, recurrenceMask.cellSize)).toBe(key);
    }
  });

  it('gère les longitudes négatives sans dérive', () => {
    // L'emprise France descend à -5,2° : Math.round aurait cassé la continuité
    // des cellules de part et d'autre de zéro.
    expect(cellKey(48.5, -1.234, 0.01)).toBe('48.50,-1.24');
    expect(cellKey(48.5, 1.234, 0.01)).toBe('48.50,1.23');
  });

  it("porte les métadonnées attendues par le service", () => {
    expect(recurrenceMask.cellSize).toBeGreaterThan(0);
    expect(recurrenceMask.thresholdDays).toBeGreaterThan(0);
    expect(recurrenceMask.frpOverrideMw).toBeGreaterThan(0);
    expect(Array.isArray(recurrenceMask.cells)).toBe(true);
    expect(recurrenceMask.cells.length).toBeGreaterThan(0);
  });
});

describe('mode historique : cache journalier et fenêtre glissante', () => {
  /** Détection hors cellule masquée, pour ne tester ici que le découpage temporel */
  const hotspotAt = (acqAt: string) => ({
    type: 'Feature' as const,
    properties: {
      acq_at: acqAt,
      lat: '43.79',
      lon: '6.32',
      frp: '5.0',
      confidence: 'High',
    },
    geometry: { type: 'Point' as const, coordinates: [6.32, 43.79] },
  });

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearHotspotsDayCache();
    fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        type: 'FeatureCollection',
        features: [
          // Fenêtre attendue pour une référence au 15/07 12:00 : [14/07 12:00, 15/07 12:00]
          hotspotAt('2026-07-14 06:00:00'), // hors fenêtre (antérieur)
          hotspotAt('2026-07-15 02:00:00'), // dans la fenêtre
          hotspotAt('2026-07-15 11:00:00'), // dans la fenêtre
          hotspotAt('2026-07-15 18:00:00'), // hors fenêtre (postérieur)
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearHotspotsDayCache();
  });

  it('ne retient que les détections de la fenêtre de 24 h fermée à la date rejouée', async () => {
    const { stats } = await createEffisHotspotsGeoJSONLayer(
      PACA_BOUNDS,
      '24h',
      { referenceDate: new Date('2026-07-15T12:00:00Z') }
    );
    expect(stats.displayed).toBe(2);
    expect(stats.latestAcquisition).toBe('2026-07-15 11:00:00');
  });

  it("ne déclenche qu'une requête pour plusieurs instants d'une même journée", async () => {
    // Sans cache, parcourir une journée au pas horaire coûterait 24 requêtes
    // pour un seul et même jeu de données.
    for (const hour of ['06:00:00', '12:00:00', '18:00:00', '23:00:00']) {
      await createEffisHotspotsGeoJSONLayer(PACA_BOUNDS, '24h', {
        referenceDate: new Date(`2026-07-15T${hour}Z`),
      });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refait une requête en changeant de journée', async () => {
    await createEffisHotspotsGeoJSONLayer(PACA_BOUNDS, '24h', {
      referenceDate: new Date('2026-07-15T12:00:00Z'),
    });
    await createEffisHotspotsGeoJSONLayer(PACA_BOUNDS, '24h', {
      referenceDate: new Date('2026-07-16T12:00:00Z'),
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('interroge le service à chaque appel en temps réel', async () => {
    // Le cache ne doit jamais servir le temps réel : la donnée doit rester fraîche.
    await createEffisHotspotsGeoJSONLayer(PACA_BOUNDS, '24h');
    await createEffisHotspotsGeoJSONLayer(PACA_BOUNDS, '24h');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("n'empoisonne pas le cache après un échec", async () => {
    clearHotspotsDayCache();
    const failing = vi.fn(async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    }));
    vi.stubGlobal('fetch', failing);

    await expect(
      createEffisHotspotsGeoJSONLayer(PACA_BOUNDS, '24h', {
        referenceDate: new Date('2026-07-15T12:00:00Z'),
      })
    ).rejects.toThrow();

    // La journée doit pouvoir être retentée, et non rester en échec définitif.
    vi.stubGlobal('fetch', fetchMock);
    const { stats } = await createEffisHotspotsGeoJSONLayer(
      PACA_BOUNDS,
      '24h',
      { referenceDate: new Date('2026-07-15T12:00:00Z') }
    );
    expect(stats.displayed).toBe(2);
  });
});

describe('rétention des points de chaleur', () => {
  it('accepte une date dans la fenêtre de 365 jours', () => {
    const reference = new Date('2026-08-06T00:00:00Z');
    const recent = new Date('2026-08-01T00:00:00Z');
    expect(isWithinHotspotsRetention(recent, reference)).toBe(true);
  });

  it('rejette une date au-delà de la rétention', () => {
    // Mesuré sur le service : aucune détection avant J-365.
    const reference = new Date('2026-08-06T00:00:00Z');
    const tooOld = new Date('2024-07-01T00:00:00Z');
    expect(isWithinHotspotsRetention(tooOld, reference)).toBe(false);
  });

  it('place le début de rétention à J-365', () => {
    const reference = new Date('2026-08-06T00:00:00Z');
    const start = getHotspotsRetentionStart(reference);
    const days = (reference.getTime() - start.getTime()) / 86_400_000;
    expect(days).toBe(EFFIS_HOTSPOTS_RETENTION_DAYS);
  });
});
