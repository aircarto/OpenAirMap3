export type TourId = "historical_mode";

export interface TourCompletionRecord {
  completedAt: string;
  skipped: boolean;
}

export type ToursCompletedMap = Partial<Record<TourId, TourCompletionRecord>>;

export const TOUR_STORAGE_KEY = "openairmap-tours-completed";

export const TOUR_SELECTORS = {
  historicalToggle: '[data-tour="historical-toggle"]',
  historicalDatePanel: '[data-tour="historical-date-panel"]',
  historicalDateRange: '[data-tour="historical-date-range"]',
  historicalLoadData: '[data-tour="historical-load-data"]',
  historicalPlayback: '[data-tour="historical-playback"]',
} as const;

export const HISTORICAL_TOUR_STEP = {
  discovery: 0,
  activation: 1,
  dateSelection: 2,
  loadData: 3,
  playback: 4,
} as const;

export type HistoricalTourStepIndex =
  (typeof HISTORICAL_TOUR_STEP)[keyof typeof HISTORICAL_TOUR_STEP];
