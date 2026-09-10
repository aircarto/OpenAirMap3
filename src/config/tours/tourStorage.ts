import {
  TOUR_STORAGE_KEY,
  TourCompletionRecord,
  TourId,
  ToursCompletedMap,
} from "./types";

export const readToursCompleted = (): ToursCompletedMap => {
  if (typeof localStorage === "undefined") {
    return {};
  }

  try {
    const raw = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as ToursCompletedMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const writeToursCompleted = (map: ToursCompletedMap): void => {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage indisponible (mode privé, quota, etc.)
  }
};

export const isTourCompleted = (tourId: TourId): boolean => {
  return Boolean(readToursCompleted()[tourId]);
};

export const markTourCompleted = (
  tourId: TourId,
  skipped = false
): TourCompletionRecord => {
  const record: TourCompletionRecord = {
    completedAt: new Date().toISOString(),
    skipped,
  };

  const map = readToursCompleted();
  map[tourId] = record;
  writeToursCompleted(map);

  return record;
};

export const resetTourCompletion = (tourId: TourId): void => {
  const map = readToursCompleted();
  delete map[tourId];
  writeToursCompleted(map);
};
