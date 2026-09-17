import type { DomainConfig } from "../config/domainConfig";
import {
  getSupportedPollutantsForTimeStep,
  isPollutantSupportedForTimeStep,
  pollutants,
} from "../constants/pollutants";
import { sources } from "../constants/sources";
import { pasDeTemps } from "../constants/timeSteps";
import {
  getDefaultPollutantForDomain,
  getDefaultSourcesForDomain,
  getDefaultTimeStepForDomain,
  isPollutantAllowedForDomain,
  isSourceAllowedForDomain,
  isTimeStepAllowedForDomain,
} from "./domainDataScope";

export interface AppUrlParams {
  lat: number;
  lng: number;
  zoom: number;
  pollutant: string;
  timeStep: string;
  sources: string[];
}

export interface AppUrlDefaults extends AppUrlParams {}

export interface SerializeAppUrlOptions {
  defaults: AppUrlDefaults;
  /** Inclure lat/lng/zoom même s'ils correspondent aux défauts (après interaction carte) */
  includeMapView?: boolean;
}

const COORD_EPSILON = 1e-5;
const MIN_ZOOM = 1;
const MAX_ZOOM = 18;

export const buildAppUrlDefaults = (
  mapDefaults: {
    mapCenter: [number, number];
    mapZoom: number;
  },
  domainConfig: DomainConfig = {} as DomainConfig
): AppUrlDefaults => ({
  lat: mapDefaults.mapCenter[0],
  lng: mapDefaults.mapCenter[1],
  zoom: mapDefaults.mapZoom,
  pollutant: getDefaultPollutantForDomain(domainConfig),
  timeStep: getDefaultTimeStepForDomain(domainConfig),
  sources: getDefaultSourcesForDomain(domainConfig),
});

const getAllValidSourceCodes = (): string[] => {
  const codes: string[] = [];

  Object.entries(sources).forEach(([key, source]) => {
    if (!source.isGroup) {
      codes.push(key);
    }
    if (source.subSources) {
      Object.keys(source.subSources).forEach((subKey) => {
        codes.push(`${key}.${subKey}`);
      });
    }
  });

  return codes;
};

const VALID_SOURCE_CODES = new Set(getAllValidSourceCodes());
const VALID_POLLUTANTS = new Set(Object.keys(pollutants));
const VALID_TIME_STEPS = new Set(Object.keys(pasDeTemps));

const parseFloatParam = (value: string | null): number | null => {
  if (value === null || value.trim() === "") {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseIntParam = (value: string | null): number | null => {
  if (value === null || value.trim() === "") {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseSourcesParam = (
  value: string | null,
  fallback: string[],
  domainConfig?: DomainConfig
): string[] => {
  if (value === null || value.trim() === "") {
    return fallback;
  }

  const parsedSources = value
    .split(",")
    .map((source) => source.trim())
    .filter(
      (source) =>
        source.length > 0 &&
        VALID_SOURCE_CODES.has(source) &&
        (!domainConfig || isSourceAllowedForDomain(source, domainConfig))
    );

  return parsedSources.length > 0 ? parsedSources : fallback;
};

const resolvePollutantForTimeStep = (
  pollutant: string,
  timeStep: string,
  fallbackPollutant: string,
  domainConfig?: DomainConfig
): string => {
  const domainOk = (code: string) =>
    !domainConfig || isPollutantAllowedForDomain(code, domainConfig);

  if (
    isPollutantSupportedForTimeStep(pollutant, timeStep) &&
    domainOk(pollutant)
  ) {
    return pollutant;
  }

  const supportedPollutants = getSupportedPollutantsForTimeStep(timeStep).filter(
    domainOk
  );
  if (supportedPollutants.includes(fallbackPollutant)) {
    return fallbackPollutant;
  }

  return supportedPollutants[0] ?? fallbackPollutant;
};

const roundCoordinate = (value: number): number =>
  Math.round(value * 100000) / 100000;

const arraysEqual = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export const parseAppUrlParams = (
  search: string,
  defaults: AppUrlDefaults,
  domainConfig?: DomainConfig
): AppUrlParams => {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );

  const latParam = parseFloatParam(params.get("lat"));
  const lngParam = parseFloatParam(params.get("lng"));
  const zoomParam = parseIntParam(params.get("zoom"));

  const lat =
    latParam !== null && latParam >= -90 && latParam <= 90
      ? latParam
      : defaults.lat;
  const lng =
    lngParam !== null && lngParam >= -180 && lngParam <= 180
      ? lngParam
      : defaults.lng;
  const zoom =
    zoomParam !== null && zoomParam >= MIN_ZOOM && zoomParam <= MAX_ZOOM
      ? zoomParam
      : defaults.zoom;

  const pollutantParam = params.get("pollutant");
  const pollutant =
    pollutantParam &&
    VALID_POLLUTANTS.has(pollutantParam) &&
    (!domainConfig || isPollutantAllowedForDomain(pollutantParam, domainConfig))
      ? pollutantParam
      : defaults.pollutant;

  const timeStepParam = params.get("timeStep");
  const timeStep =
    timeStepParam &&
    VALID_TIME_STEPS.has(timeStepParam) &&
    (!domainConfig || isTimeStepAllowedForDomain(timeStepParam, domainConfig))
      ? timeStepParam
      : defaults.timeStep;

  const parsedSources = parseSourcesParam(
    params.get("sources"),
    defaults.sources,
    domainConfig
  );

  return {
    lat,
    lng,
    zoom,
    pollutant: resolvePollutantForTimeStep(
      pollutant,
      timeStep,
      defaults.pollutant,
      domainConfig
    ),
    timeStep,
    sources: parsedSources,
  };
};

export const serializeAppUrlParams = (
  state: AppUrlParams,
  options: SerializeAppUrlOptions
): string => {
  const { defaults, includeMapView = false } = options;
  const params = new URLSearchParams();

  const shouldIncludeMapView =
    includeMapView ||
    Math.abs(state.lat - defaults.lat) > COORD_EPSILON ||
    Math.abs(state.lng - defaults.lng) > COORD_EPSILON ||
    state.zoom !== defaults.zoom;

  if (shouldIncludeMapView) {
    params.set("lat", roundCoordinate(state.lat).toString());
    params.set("lng", roundCoordinate(state.lng).toString());
    params.set("zoom", state.zoom.toString());
  }

  if (state.pollutant !== defaults.pollutant) {
    params.set("pollutant", state.pollutant);
  }

  if (state.timeStep !== defaults.timeStep) {
    params.set("timeStep", state.timeStep);
  }

  if (!arraysEqual(state.sources, defaults.sources)) {
    params.set("sources", state.sources.join(","));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
};

export const areAppUrlParamsEqual = (
  a: AppUrlParams,
  b: AppUrlParams
): boolean =>
  Math.abs(a.lat - b.lat) <= COORD_EPSILON &&
  Math.abs(a.lng - b.lng) <= COORD_EPSILON &&
  a.zoom === b.zoom &&
  a.pollutant === b.pollutant &&
  a.timeStep === b.timeStep &&
  arraysEqual(a.sources, b.sources);

export const buildAppUrl = (
  state: AppUrlParams,
  options: SerializeAppUrlOptions
): string => `${window.location.pathname}${serializeAppUrlParams(state, options)}`;
