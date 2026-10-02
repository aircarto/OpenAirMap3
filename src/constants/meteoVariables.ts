import type { Seuils } from '../types';

/** Zoom minimum (PoC) avant fetch des observations MF. */
export const METEO_FRANCE_MIN_ZOOM = 8;

/** Concurrence max pour les appels 1-station (quota ~50 req/min). */
export const METEO_FRANCE_FETCH_CONCURRENCY = 6;

export type MeteoVariableCode =
  | 'vent'
  | 'temperature'
  | 'humidite'
  | 'precipitation';

export interface MeteoVariable {
  name: string;
  code: MeteoVariableCode;
  unit: string;
  /** Champ principal GeoJSON DPObs */
  field: string;
  /** Champ direction vent (degrés), si applicable */
  directionField?: string;
  /** Conversion Kelvin → °C pour `t` */
  convertKelvinToCelsius?: boolean;
  /** Seuils pour colorer les marqueurs (réutilise les codes qualité) */
  thresholds: Seuils;
  supportedTimeSteps: string[];
}

/** Ordre d'affichage dans le menu Variables */
export const METEO_VARIABLE_ORDER: MeteoVariableCode[] = [
  'vent',
  'temperature',
  'humidite',
  'precipitation',
];

export const meteoVariables: Record<MeteoVariableCode, MeteoVariable> = {
  vent: {
    name: 'Vent',
    code: 'vent',
    unit: 'm/s',
    field: 'ff',
    directionField: 'dd',
    supportedTimeSteps: ['instantane', 'heure'],
    // Beaufort simplifié (vitesse moyenne en m/s)
    thresholds: {
      bon: { code: 'bon', min: 0, max: 1.5 },
      moyen: { code: 'moyen', min: 1.5, max: 3.3 },
      degrade: { code: 'degrade', min: 3.3, max: 5.4 },
      mauvais: { code: 'mauvais', min: 5.4, max: 7.9 },
      tresMauvais: { code: 'tresMauvais', min: 7.9, max: 10.7 },
      extrMauvais: { code: 'extrMauvais', min: 10.7, max: 999 },
    },
  },
  temperature: {
    name: 'Température',
    code: 'temperature',
    unit: '°C',
    field: 't',
    convertKelvinToCelsius: true,
    supportedTimeSteps: ['instantane', 'heure'],
    thresholds: {
      bon: { code: 'bon', min: -50, max: 5 },
      moyen: { code: 'moyen', min: 5, max: 15 },
      degrade: { code: 'degrade', min: 15, max: 22 },
      mauvais: { code: 'mauvais', min: 22, max: 28 },
      tresMauvais: { code: 'tresMauvais', min: 28, max: 35 },
      extrMauvais: { code: 'extrMauvais', min: 35, max: 60 },
    },
  },
  humidite: {
    name: 'Humidité',
    code: 'humidite',
    unit: '%',
    field: 'u',
    supportedTimeSteps: ['instantane', 'heure'],
    thresholds: {
      bon: { code: 'bon', min: 0, max: 30 },
      moyen: { code: 'moyen', min: 30, max: 50 },
      degrade: { code: 'degrade', min: 50, max: 70 },
      mauvais: { code: 'mauvais', min: 70, max: 85 },
      tresMauvais: { code: 'tresMauvais', min: 85, max: 95 },
      extrMauvais: { code: 'extrMauvais', min: 95, max: 100 },
    },
  },
  precipitation: {
    name: 'Précipitations',
    code: 'precipitation',
    unit: 'mm',
    field: 'rr_per',
    supportedTimeSteps: ['instantane', 'heure'],
    thresholds: {
      bon: { code: 'bon', min: 0, max: 0.1 },
      moyen: { code: 'moyen', min: 0.1, max: 1 },
      degrade: { code: 'degrade', min: 1, max: 3 },
      mauvais: { code: 'mauvais', min: 3, max: 8 },
      tresMauvais: { code: 'tresMauvais', min: 8, max: 15 },
      extrMauvais: { code: 'extrMauvais', min: 15, max: 500 },
    },
  },
};

export const getDefaultMeteoVariable = (): MeteoVariableCode => 'vent';

export const isMeteoVariableCode = (code: string): code is MeteoVariableCode =>
  Object.prototype.hasOwnProperty.call(meteoVariables, code);

export const isMeteoVariableSupportedForTimeStep = (
  code: string,
  timeStep: string
): boolean => {
  if (!isMeteoVariableCode(code)) return false;
  return meteoVariables[code].supportedTimeSteps.includes(timeStep);
};

/**
 * Niveau de couleur pour un paramètre météo (réutilise les codes qualité carte).
 */
export const getMeteoQualityLevel = (
  value: number,
  thresholds: Seuils
): string => {
  if (value <= thresholds.bon.max) return 'bon';
  if (value <= thresholds.moyen.max) return 'moyen';
  if (value <= thresholds.degrade.max) return 'degrade';
  if (value <= thresholds.mauvais.max) return 'mauvais';
  if (value <= thresholds.tresMauvais.max) return 'tresMauvais';
  return 'extrMauvais';
};

/**
 * Convertit une valeur brute DPObs vers l'unité d'affichage.
 */
export const convertMeteoRawValue = (
  raw: number,
  variable: MeteoVariable
): number => {
  if (variable.convertKelvinToCelsius) {
    return raw - 273.15;
  }
  return raw;
};
