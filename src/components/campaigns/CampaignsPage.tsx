'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { Link } from '../../i18n/navigation';
import { VARIABLE_ISO_CODES } from '../../services/AtmoMicroV2Service';
import { MicrospotCampaignClient } from '../../services/microspot/MicrospotCampaignClient';
import { resolveCampaignPeriod } from '../../services/microspot/campaignPeriod';
import {
  buildExtractionTargets,
  planChunks,
  type ExtractionRequest,
} from '../../services/microspot/campaignExtraction';
import {
  assignStoreToLocalisations,
  buildCampaignLocalisations,
  normalizeName,
  type CampaignLocalisation,
  type Presence,
} from '../../services/microspot/campaignLocalisations';
import { reverseGeocode } from '../../services/geocoding/banReverse';
import type {
  MicrospotCampaignListItem,
  MicrospotDeviceWithLocationHistory,
  MicrospotStatusCode,
  MicrospotStudy,
} from '../../types';
import { useCampaignExtraction } from './useCampaignExtraction';
import { CampaignSiteList, type SiteListItem } from './CampaignSiteList';
import type { CampaignMapSite } from './CampaignMap';
import type { CampaignChartSeries, ChartSeriesData } from './CampaignChart';

const CampaignMap = dynamic(() => import('./CampaignMap'), { ssr: false });
const CampaignChart = dynamic(() => import('./CampaignChart'), { ssr: false });

/** Polluants proposés, dans l'ordre d'affichage. */
const CAMPAIGN_POLLUTANTS = ['pm1', 'pm25', 'pm10', 'no2', 'o3', 'so2'] as const;
const DEFAULT_POLLUTANTS = ['pm25', 'pm10'];

/** Au-delà de ce nombre de courbes, pas d'affichage automatique : illisible. */
const AUTO_SELECT_MAX = 8;

const PALETTE = [
  '#1f77b4', '#d62728', '#2ca02c', '#ff7f0e', '#9467bd', '#8c564b',
  '#e377c2', '#17becf', '#bcbd22', '#7f7f7f', '#393b79', '#ad494a',
  '#637939', '#e6550d', '#3182bd', '#843c39',
];

const pad = (n: number) => String(n).padStart(2, '0');
/** Date au format des <input type="date">, en heure locale. */
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromDateInput = (s: string) => new Date(`${s}T00:00:00`);

const formatNumber = (n: number, locale: string) => new Intl.NumberFormat(locale).format(n);

/** « 2025-04-03 → 2026-02-24 » (ou « → en cours ») sur un ensemble de présences. */
const periodOf = (presences: Presence[], ongoing: string): string => {
  const starts = presences.map((p) => p.start).filter((s): s is string => Boolean(s)).sort();
  const open = presences.some((p) => !p.end);
  const ends = presences.map((p) => p.end).filter((s): s is string => Boolean(s)).sort();
  const start = starts[0]?.slice(0, 10) ?? '?';
  const end = open ? ongoing : (ends.at(-1)?.slice(0, 10) ?? '?');
  return `${start} → ${end}`;
};

const toggleInSet = <T,>(set: Set<T>, value: T): Set<T> => {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};

export const CampaignsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'fr';
  const { user, logout } = useAuth();

  // Référentiels
  const [studies, setStudies] = useState<MicrospotStudy[] | null>(null);
  const [campaigns, setCampaigns] = useState<MicrospotCampaignListItem[] | null>(null);
  const [histories, setHistories] = useState<MicrospotDeviceWithLocationHistory[] | null>(null);
  const [statusCodes, setStatusCodes] = useState<MicrospotStatusCode[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  // Sélection
  const [studyId, setStudyId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [pollutants, setPollutants] = useState<string[]>(DEFAULT_POLLUTANTS);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Localisations : extraction (avant chargement) et affichage (après)
  const [sitesToExtract, setSitesToExtract] = useState<Set<string>>(new Set());
  const [shownSites, setShownSites] = useState<Set<string>>(new Set());
  /** Capteurs masqués individuellement : `${siteKey}|${deviceId}`. */
  const [hiddenDevices, setHiddenDevices] = useState<Set<string>>(new Set());
  const [hoveredSite, setHoveredSite] = useState<string | null>(null);
  const [chartPollutant, setChartPollutant] = useState<string>('pm25');
  const [addresses, setAddresses] = useState<Map<string, string | null>>(new Map());

  const extraction = useCampaignExtraction();
  const { state, store } = extraction;
  const running = state.status === 'running';

  useEffect(() => {
    const controller = new AbortController();
    MicrospotCampaignClient.listCampaigns(controller.signal)
      .then(setCampaigns)
      .catch((e) => {
        if (!controller.signal.aborted) setListError(e instanceof Error ? e.message : String(e));
      });
    // Historique des positions : base des localisations (sites citoyens compris).
    MicrospotCampaignClient.listDeviceLocationHistories(controller.signal)
      .then(setHistories)
      .catch(() => setHistories([]));
    // Études et codes d'état : optionnels, la page reste utilisable sans.
    MicrospotCampaignClient.listStudies(controller.signal)
      .then(setStudies)
      .catch(() => setStudies([]));
    MicrospotCampaignClient.listStatusCodes(controller.signal)
      .then(setStatusCodes)
      .catch(() => setStatusCodes([]));
    return () => controller.abort();
  }, []);

  const campaign = useMemo(
    () => campaigns?.find((c) => c.id === campaignId) ?? null,
    [campaigns, campaignId]
  );
  const study = useMemo(
    () => studies?.find((s) => campaign?.study_id != null && s.id === campaign.study_id) ?? null,
    [studies, campaign]
  );
  const period = useMemo(() => (campaign ? resolveCampaignPeriod(campaign) : null), [campaign]);

  const filteredCampaigns = useMemo(() => {
    const q = normalizeName(search);
    return (campaigns ?? [])
      .filter((c) => studyId === 'all' || String(c.study_id ?? '') === studyId)
      .filter((c) => !q || normalizeName(c.name).includes(q))
      .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? '') || a.name.localeCompare(b.name));
  }, [campaigns, studyId, search]);

  /** Localisations de la campagne, d'après l'historique des positions. */
  const localisations = useMemo<CampaignLocalisation[]>(
    () => (campaign && histories ? buildCampaignLocalisations(campaign, histories) : []),
    [campaign, histories]
  );
  const localisationSignature = localisations.map((l) => l.key).join('|');

  // Changement de campagne : période préremplie, remise à zéro.
  useEffect(() => {
    extraction.reset();
    setShownSites(new Set());
    setHiddenDevices(new Set());
    setHoveredSite(null);
    if (!campaign || !period) return;
    setFromDate(period.start ? toDateInput(period.start) : '');
    setToDate(toDateInput(period.end));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- réagit au seul changement de campagne
  }, [campaign?.id]);

  // Toutes les localisations sont à extraire par défaut.
  useEffect(() => {
    setSitesToExtract(new Set(localisations.map((l) => l.key)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- suit la liste des localisations
  }, [campaign?.id, localisationSignature]);

  /** Rattachement des mesures aux localisations (recalculé à chaque chargement). */
  const assignment = useMemo(
    () => (store && !running && store.rowCount > 0 ? assignStoreToLocalisations(store, localisations) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- store muté, suivi par state.version
    [store, running, localisations, state.version]
  );

  const allLocalisations = useMemo(
    () => [...localisations, ...(assignment?.discovered ?? [])],
    [localisations, assignment]
  );

  /** Nom des capteurs : historique, puis mesures reçues. */
  const deviceNames = useMemo(() => {
    const names = new Map<string, string>();
    const ids = new Set((campaign?.devices ?? []).map((d) => d.id));
    for (const h of histories ?? []) if (h.name && ids.has(h.id)) names.set(h.id, h.name);
    if (store) {
      for (const s of store.getSeries()) {
        if (s.deviceName && !names.has(s.deviceId)) names.set(s.deviceId, s.deviceName);
      }
    }
    return names;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- store muté, suivi par state.version
  }, [campaign, histories, store, state.version]);

  const deviceLabel = useCallback((id: string) => deviceNames.get(id) ?? id, [deviceNames]);

  // Adresses des localisations déclarées (capteurs citoyens), via la BAN.
  useEffect(() => {
    let cancelled = false;
    for (const loc of allLocalisations) {
      if (loc.kind !== 'declared' || loc.lat === null || loc.lon === null || addresses.has(loc.key)) continue;
      void reverseGeocode(loc.lat, loc.lon).then((address) => {
        if (!cancelled) setAddresses((prev) => new Map(prev).set(loc.key, address));
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- addresses lu pour éviter les doublons
  }, [allLocalisations]);

  /** Capteurs d'une localisation : historique + capteurs vus dans les mesures. */
  const devicesOf = useCallback(
    (loc: CampaignLocalisation): string[] => {
      const ids = loc.devices.map((d) => d.deviceId);
      for (const seriesKeyOf of assignment?.parts.get(loc.key)?.keys() ?? []) {
        const deviceId = store?.getSeriesByKey(seriesKeyOf)?.deviceId;
        if (deviceId && !ids.includes(deviceId)) ids.push(deviceId);
      }
      return ids;
    },
    [assignment, store]
  );

  const siteLabel = useCallback(
    (loc: CampaignLocalisation): string => {
      if (loc.kind === 'named') return loc.apiName ?? loc.key;
      const first = devicesOf(loc)[0];
      const device = first ? deviceLabel(first) : '?';
      if (loc.kind === 'undeclared') return `${device} · ${t('campaigns.sites.undeclared')}`;
      const address = addresses.get(loc.key);
      const coords = loc.lat !== null && loc.lon !== null ? `${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)}` : '';
      return `${device} · ${address ?? coords}`;
    },
    [addresses, deviceLabel, devicesOf, t]
  );

  const labelByKey = useMemo(
    () => new Map(allLocalisations.map((l) => [l.key, siteLabel(l)])),
    [allLocalisations, siteLabel]
  );

  const colorByKey = useMemo(
    () => new Map(allLocalisations.map((l, i) => [l.key, PALETTE[i % PALETTE.length]!])),
    [allLocalisations]
  );

  const rowsBySite = useMemo(() => {
    const map = new Map<string, number>();
    const byDevice = new Map<string, number>();
    if (!assignment || !store) return { map, byDevice };
    for (const [key, bySeries] of assignment.parts) {
      for (const [sk, indices] of bySeries) {
        map.set(key, (map.get(key) ?? 0) + indices.length);
        const deviceId = store.getSeriesByKey(sk)?.deviceId;
        if (deviceId) byDevice.set(`${key}|${deviceId}`, (byDevice.get(`${key}|${deviceId}`) ?? 0) + indices.length);
      }
    }
    return { map, byDevice };
  }, [assignment, store]);

  const hasData = Boolean(store && store.rowCount > 0 && !running);

  const request = useMemo<ExtractionRequest | null>(() => {
    if (!campaign || !fromDate || !toDate || pollutants.length === 0) return null;
    const from = fromDateInput(fromDate);
    const endOfDay = fromDateInput(toDate);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const to = new Date(Math.min(endOfDay.getTime(), Date.now()));
    if (!(to > from)) return null;
    return {
      campaignId: campaign.id,
      targets: buildExtractionTargets(campaign.devices ?? [], localisations, sitesToExtract),
      variables: pollutants.map((p) => VARIABLE_ISO_CODES[p]!).filter(Boolean),
      from,
      to,
    };
  }, [campaign, fromDate, toDate, pollutants, localisations, sitesToExtract]);

  const plannedRequests = useMemo(() => (request ? planChunks(request).length : 0), [request]);

  const handleLoad = () => {
    if (!request) return;
    extraction.start(request);
    setShownSites(new Set());
    setHiddenDevices(new Set());
    if (!pollutants.includes(chartPollutant)) setChartPollutant(pollutants[0]!);
  };

  /** Sous-séries (localisation × capteur × variable), mises en cache par chargement. */
  // eslint-disable-next-line react-hooks/exhaustive-deps -- cache vidé à chaque nouveau rattachement
  const subSeriesCache = useMemo(() => new Map<string, ChartSeriesData>(), [assignment]);

  const chartSeriesFor = useCallback(
    (sites: Iterable<string>, iso: string, hovered: string | null): CampaignChartSeries[] => {
      if (!assignment || !store) return [];
      const out: CampaignChartSeries[] = [];
      for (const key of sites) {
        const bySeries = assignment.parts.get(key);
        if (!bySeries) continue;
        const loc = allLocalisations.find((l) => l.key === key);
        const deviceIds = loc ? devicesOf(loc) : [];
        const parts = [...bySeries.entries()]
          .map(([sk, indices]) => ({ s: store.getSeriesByKey(sk)!, indices }))
          .filter(({ s }) => s && s.variableIso === iso)
          .sort((a, b) => deviceLabel(a.s.deviceId).localeCompare(deviceLabel(b.s.deviceId), undefined, { numeric: true }));
        parts.forEach(({ s, indices }, n) => {
          if (hiddenDevices.has(`${key}|${s.deviceId}`)) return;
          const cacheKey = `${key}|${s.key}`;
          let data = subSeriesCache.get(cacheKey);
          if (!data) {
            const time = new Float64Array(indices.length);
            const valueRef = new Float64Array(indices.length);
            indices.forEach((i, j) => {
              time[j] = s.time[i]!;
              valueRef[j] = s.valueRef[i]!;
            });
            data = { length: indices.length, time, valueRef };
            subSeriesCache.set(cacheKey, data);
          }
          const site = labelByKey.get(key) ?? key;
          out.push({
            key: cacheKey,
            label: deviceIds.length > 1 || parts.length > 1 ? `${site} · ${deviceLabel(s.deviceId)}` : site,
            color: colorByKey.get(key) ?? '#1f3c6d',
            series: data,
            dashed: n > 0,
            highlighted: hovered === key,
          });
        });
      }
      return out;
    },
    [assignment, store, allLocalisations, devicesOf, deviceLabel, hiddenDevices, subSeriesCache, labelByKey, colorByKey]
  );

  // Fin de chargement : affichage automatique si le graphique reste lisible.
  useEffect(() => {
    if (state.status !== 'done' || !assignment) return;
    const iso = VARIABLE_ISO_CODES[chartPollutant] ?? '';
    const withData = [...assignment.parts.keys()];
    if (chartSeriesFor(withData, iso, null).length <= AUTO_SELECT_MAX) setShownSites(new Set(withData));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une fois par chargement
  }, [state.status, assignment]);

  const loadedPollutants = useMemo(() => {
    if (!state.request) return [];
    return CAMPAIGN_POLLUTANTS.filter((p) => state.request!.variables.includes(VARIABLE_ISO_CODES[p]!));
  }, [state.request]);

  const chartSeries = useMemo<CampaignChartSeries[]>(() => {
    if (running) return [];
    const iso = VARIABLE_ISO_CODES[chartPollutant];
    if (!iso) return [];
    const sites = allLocalisations
      .map((l) => l.key)
      .filter((k) => shownSites.has(k) || k === hoveredSite);
    return chartSeriesFor(sites, iso, hoveredSite);
  }, [running, chartPollutant, allLocalisations, shownSites, hoveredSite, chartSeriesFor]);

  const chartUnit =
    (store && !running && store.getSeries().find((s) => s.variableIso === VARIABLE_ISO_CODES[chartPollutant])?.unit) ||
    'µg/m³';

  const siteItems = useMemo<SiteListItem[]>(
    () =>
      allLocalisations.map((loc) => {
        const ids = devicesOf(loc);
        const presences = loc.devices.flatMap((d) => d.presences);
        const address = addresses.get(loc.key);
        return {
          key: loc.key,
          label: labelByKey.get(loc.key) ?? loc.key,
          detail:
            loc.kind === 'declared' && address === undefined && loc.lat !== null
              ? t('campaigns.sites.resolving')
              : null,
          period: presences.length > 0 ? periodOf(presences, t('campaigns.ongoing')) : '',
          color: colorByKey.get(loc.key) ?? '#1f3c6d',
          kind: loc.kind,
          discovered: Boolean(loc.discovered),
          extract: loc.discovered ? true : sitesToExtract.has(loc.key),
          shown: shownSites.has(loc.key),
          rows: rowsBySite.map.get(loc.key),
          devices: ids.map((id) => ({
            id,
            label: deviceLabel(id),
            period: periodOf(
              loc.devices.find((d) => d.deviceId === id)?.presences ?? [],
              t('campaigns.ongoing')
            ),
            hidden: hiddenDevices.has(`${loc.key}|${id}`),
            rows: rowsBySite.byDevice.get(`${loc.key}|${id}`),
          })),
        };
      }),
    [allLocalisations, devicesOf, addresses, labelByKey, colorByKey, sitesToExtract, shownSites, rowsBySite, deviceLabel, hiddenDevices, t]
  );

  const mapSites = useMemo<CampaignMapSite[]>(
    () =>
      siteItems.flatMap((item) => {
        const loc = allLocalisations.find((l) => l.key === item.key);
        if (!loc || loc.lat === null || loc.lon === null) return [];
        return [
          {
            key: item.key,
            name: item.label,
            lat: loc.lat,
            lon: loc.lon,
            color: item.color,
            deviceCount: item.devices.length,
            extract: item.extract,
            shown: item.shown,
            discovered: item.discovered,
          },
        ];
      }),
    [siteItems, allLocalisations]
  );

  const handleMapClick = (key: string) => {
    if (running) return;
    if (hasData) {
      if (assignment?.parts.has(key)) setShownSites((prev) => toggleInSet(prev, key));
    } else if (!key.includes(':obs')) {
      setSitesToExtract((prev) => toggleInSet(prev, key));
    }
  };

  const handleExport = () => {
    if (!campaign) return;
    void extraction.exportCsv({
      studyId: campaign.study_id ?? null,
      studyName: study?.name ?? null,
      campaignId: campaign.id,
      campaignName: campaign.name,
      statusLabels: new Map(statusCodes.map((c) => [String(c.id), c.label ?? c.description ?? ''])),
      deviceNames,
      siteFor: (seriesKeyOf, i) => {
        const key = assignment?.rowKeys.get(seriesKeyOf)?.[i];
        return key ? { key, label: labelByKey.get(key) ?? key } : null;
      },
    });
  };

  const progress = state.progress;
  const progressPct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const sourceLabel = (source: string) => t(`campaigns.periodSource.${source}`);

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-medium text-[#1f3c6d] hover:underline">
            ← {t('campaigns.backToMap')}
          </Link>
          <h1 className="text-lg font-semibold text-[#1f3c6d]">{t('campaigns.title')}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>{user?.preferredUsername ?? user?.email ?? ''}</span>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100"
          >
            {t('auth.logout')}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Barre de sélection */}
        <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-b border-slate-200 bg-white p-4 lg:w-[380px] lg:border-b-0 lg:border-r">
          {listError && (
            <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {t('campaigns.listError')} ({listError})
            </p>
          )}

          {studies && studies.length > 0 && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('campaigns.study')}</span>
              <select
                value={studyId}
                onChange={(e) => setStudyId(e.target.value)}
                disabled={running}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5"
                data-testid="campaigns-study-select"
              >
                <option value="all">{t('campaigns.allStudies')}</option>
                {[...studies]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
          )}

          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor="campaign-search" className="font-medium">
              {t('campaigns.campaign')}
            </label>
            <input
              id="campaign-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('campaigns.searchPlaceholder')}
              disabled={running}
              className="rounded-md border border-slate-300 px-2 py-1.5"
            />
            <ul
              className="max-h-56 overflow-y-auto rounded-md border border-slate-200"
              role="listbox"
              aria-label={t('campaigns.campaign')}
              data-testid="campaigns-list"
            >
              {campaigns === null && !listError && (
                <li className="px-3 py-2 text-slate-500">{t('campaigns.loadingList')}</li>
              )}
              {campaigns !== null && filteredCampaigns.length === 0 && (
                <li className="px-3 py-2 text-slate-500">{t('campaigns.noCampaign')}</li>
              )}
              {filteredCampaigns.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.id === campaignId}
                    disabled={running}
                    onClick={() => setCampaignId(c.id)}
                    className={`flex w-full flex-col items-start px-3 py-2 text-left hover:bg-slate-50 ${
                      c.id === campaignId ? 'bg-[#1f3c6d]/10' : ''
                    }`}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-slate-500">
                      {t('campaigns.deviceCount', { count: c.devices?.length ?? 0 })}
                      {c.start_date ? ` · ${c.start_date.slice(0, 10)}` : ''}
                      {c.end_date ? ` → ${c.end_date.slice(0, 10)}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {campaign && period && (
            <>
              <fieldset className="flex flex-col gap-2 text-sm" disabled={running}>
                <legend className="mb-1 font-medium">{t('campaigns.pollutants')}</legend>
                <div className="flex flex-wrap gap-2">
                  {CAMPAIGN_POLLUTANTS.map((p) => (
                    <label
                      key={p}
                      className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2 py-1"
                    >
                      <input
                        type="checkbox"
                        checked={pollutants.includes(p)}
                        onChange={(e) =>
                          setPollutants((prev) =>
                            e.target.checked ? [...prev, p] : prev.filter((x) => x !== p)
                          )
                        }
                      />
                      {t(`pollutants.${p}`)}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-2 text-sm" disabled={running}>
                <legend className="mb-1 font-medium">
                  {t('campaigns.period')} <span className="font-normal text-slate-500">({t('campaigns.hourly')})</span>
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-600">{t('campaigns.from')}</span>
                    <input
                      type="date"
                      value={fromDate}
                      max={toDate || toDateInput(new Date())}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="rounded-md border border-slate-300 px-2 py-1"
                      data-testid="campaigns-from"
                    />
                    <span className="text-xs text-slate-500">{sourceLabel(period.startSource)}</span>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-600">{t('campaigns.to')}</span>
                    <input
                      type="date"
                      value={toDate}
                      min={fromDate || undefined}
                      max={toDateInput(new Date())}
                      onChange={(e) => setToDate(e.target.value)}
                      className="rounded-md border border-slate-300 px-2 py-1"
                      data-testid="campaigns-to"
                    />
                    <span className="text-xs text-slate-500">{sourceLabel(period.endSource)}</span>
                  </label>
                </div>
                {period.earlierDeviceStart && fromDate !== toDateInput(period.earlierDeviceStart) && (
                  <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
                    {t('campaigns.earlierDevices', { date: toDateInput(period.earlierDeviceStart) })}{' '}
                    <button
                      type="button"
                      className="font-medium underline"
                      onClick={() => setFromDate(toDateInput(period.earlierDeviceStart!))}
                    >
                      {t('campaigns.extendPeriod')}
                    </button>
                  </p>
                )}
              </fieldset>

              <div className="flex flex-col gap-2">
                {!running ? (
                  <button
                    type="button"
                    onClick={handleLoad}
                    disabled={!request || plannedRequests === 0}
                    className="rounded-md bg-[#1f3c6d] px-4 py-2 text-sm font-medium text-white hover:bg-[#183055] disabled:opacity-50"
                    data-testid="campaigns-load"
                  >
                    {t('campaigns.load')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={extraction.cancel}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
                  >
                    {t('campaigns.cancel')}
                  </button>
                )}
                {request && !running && (
                  <p className="text-xs text-slate-500">
                    {t('campaigns.plannedRequests', { count: plannedRequests })}
                  </p>
                )}

                {progress && state.status !== 'idle' && (
                  <div className="flex flex-col gap-1" aria-live="polite">
                    <div
                      className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
                      role="progressbar"
                      aria-valuenow={progressPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="h-full bg-[#1f3c6d] transition-[width]" style={{ width: `${progressPct}%` }} />
                    </div>
                    <p className="text-xs text-slate-600">
                      {t('campaigns.progress', {
                        done: formatNumber(progress.done, locale),
                        total: formatNumber(progress.total, locale),
                        rows: formatNumber(progress.rows, locale),
                      })}
                    </p>
                  </div>
                )}

                {state.status === 'aborted' && (
                  <p className="text-xs text-amber-700">{t('campaigns.aborted')}</p>
                )}
                {state.status === 'error' && (
                  <p role="alert" className="rounded-md bg-red-50 p-2 text-xs text-red-700">
                    {state.authError ? t('campaigns.sessionExpired') : `${t('campaigns.error')} (${state.error})`}
                  </p>
                )}
                {state.failures.length > 0 && !running && (
                  <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
                    <p>{t('campaigns.failures', { count: state.failures.length })}</p>
                    <ul className="mt-1 max-h-24 list-disc overflow-y-auto pl-4">
                      {state.failures.slice(0, 20).map((f, i) => (
                        <li key={i}>
                          {deviceLabel(f.chunk.deviceId)} · {toDateInput(f.chunk.from)} → {toDateInput(f.chunk.to)} :{' '}
                          {f.message}
                        </li>
                      ))}
                    </ul>
                    <button type="button" className="mt-1 font-medium underline" onClick={extraction.retryFailures}>
                      {t('campaigns.retryFailures')}
                    </button>
                  </div>
                )}

                {hasData && (
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={extraction.exporting !== null}
                    className="rounded-md border border-[#1f3c6d] px-4 py-2 text-sm font-medium text-[#1f3c6d] hover:bg-[#1f3c6d]/5 disabled:opacity-50"
                    data-testid="campaigns-export"
                  >
                    {extraction.exporting
                      ? t('campaigns.exporting', {
                          pct:
                            extraction.exporting.total > 0
                              ? Math.round((extraction.exporting.written / extraction.exporting.total) * 100)
                              : 0,
                        })
                      : t('campaigns.exportCsv', { rows: formatNumber(store!.finalizedRowCount, locale) })}
                  </button>
                )}
              </div>

              {/* Localisations */}
              <CampaignSiteList
                items={siteItems}
                hasData={hasData}
                running={running}
                onToggleExtract={(key) => setSitesToExtract((prev) => toggleInSet(prev, key))}
                onSetAllExtract={(value) =>
                  setSitesToExtract(value ? new Set(localisations.map((l) => l.key)) : new Set())
                }
                onToggleShown={(key) => setShownSites((prev) => toggleInSet(prev, key))}
                onSetAllShown={(value) =>
                  setShownSites(value && assignment ? new Set(assignment.parts.keys()) : new Set())
                }
                onToggleDevice={(key, deviceId) =>
                  setHiddenDevices((prev) => toggleInSet(prev, `${key}|${deviceId}`))
                }
                onHover={setHoveredSite}
              />
            </>
          )}
        </aside>

        {/* Carte + graphique */}
        <main className="flex min-h-0 flex-1 flex-col">
          <section className="relative min-h-[260px] flex-1" aria-label={t('campaigns.mapLabel')}>
            <CampaignMap
              sites={mapSites}
              onClickSite={handleMapClick}
              onHoverSite={setHoveredSite}
              devicesLabel={(count) => t('campaigns.deviceCount', { count })}
            />
          </section>
          <section
            className="flex h-[42%] min-h-[280px] flex-col border-t border-slate-200 bg-white"
            aria-label={t('campaigns.chartLabel')}
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2 text-sm">
              <span className="font-medium">{t('campaigns.chartTitle')}</span>
              {loadedPollutants.length > 0 && (
                <select
                  value={chartPollutant}
                  onChange={(e) => setChartPollutant(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1"
                  aria-label={t('campaigns.chartPollutant')}
                >
                  {loadedPollutants.map((p) => (
                    <option key={p} value={p}>
                      {t(`pollutants.${p}`)}
                    </option>
                  ))}
                </select>
              )}
              <span className="text-xs text-slate-500">{t('campaigns.chartHint')}</span>
            </div>
            <div className="min-h-0 flex-1 px-2 pb-2">
              <CampaignChart
                series={chartSeries}
                unit={chartUnit}
                emptyMessage={
                  running
                    ? t('campaigns.chartLoading')
                    : hasData
                      ? t('campaigns.chartEmptySelection')
                      : t('campaigns.chartEmpty')
                }
              />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default CampaignsPage;
