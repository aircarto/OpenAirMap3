import { useCallback, useEffect, useRef, useState } from "react";
import { driver, type Driver } from "driver.js";
import { useTranslation } from "react-i18next";
import { buildHistoricalModeTourSteps } from "../config/tours/historicalModeTour";
import { buildAppOverviewTourSteps } from "../config/tours/globalAppTour";
import {
  isTourCompleted,
  markTourCompleted,
  resetTourCompletion,
} from "../config/tours/tourStorage";
import {
  type HistoricalTourStepIndex,
  type TourId,
} from "../config/tours/types";
import { trackFeatureUsage } from "../services/analyticsService";

const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

export interface UseFeatureTourResult {
  activeTourId: TourId | null;
  activeStepIndex: number | null;
  isTourActive: boolean;
  isTourCompleted: (tourId: TourId) => boolean;
  startTour: (tourId: TourId, options?: { replay?: boolean }) => void;
  stopTour: (options?: { skipped?: boolean }) => void;
  resetTour: (tourId: TourId) => void;
  driveToStep: (stepIndex: HistoricalTourStepIndex) => void;
}

export const useFeatureTour = (): UseFeatureTourResult => {
  const { t, i18n } = useTranslation();
  const driverRef = useRef<Driver | null>(null);
  const activeTourIdRef = useRef<TourId | null>(null);
  const [activeTourId, setActiveTourId] = useState<TourId | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);

  const destroyDriver = useCallback(() => {
    driverRef.current?.destroy();
    driverRef.current = null;
    activeTourIdRef.current = null;
    setActiveTourId(null);
    setActiveStepIndex(null);
  }, []);

  const stopTour = useCallback(
    (options?: { skipped?: boolean }) => {
      const tourId = activeTourIdRef.current;
      if (tourId) {
        markTourCompleted(tourId, options?.skipped ?? false);
        trackFeatureUsage(options?.skipped ? "tour_skipped" : "tour_completed", {
          tourId,
          locale: i18n.language,
        });
      }

      destroyDriver();
    },
    [destroyDriver, i18n.language]
  );

  const createDriverForTour = useCallback(
    (tourId: TourId): Driver => {
      const steps =
        tourId === "historical_mode"
          ? buildHistoricalModeTourSteps(t)
          : buildAppOverviewTourSteps(t);

      const instance = driver({
        animate: !prefersReducedMotion(),
        allowClose: true,
        overlayOpacity: 0.55,
        overlayColor: "#0f172a",
        stagePadding: 8,
        stageRadius: 8,
        smoothScroll: !prefersReducedMotion(),
        showProgress: true,
        progressText: t("tour.common.progress"),
        nextBtnText: t("tour.common.next"),
        prevBtnText: t("tour.common.previous"),
        doneBtnText: t("tour.common.done"),
        popoverClass: "openairmap-tour-popover",
        steps,
        onCloseClick: (_element, _step, { driver: activeDriver }) => {
          stopTour({ skipped: !activeDriver.isLastStep() });
        },
        onDestroyed: () => {
          activeTourIdRef.current = null;
          setActiveTourId(null);
          setActiveStepIndex(null);
          driverRef.current = null;
        },
        onHighlighted: (_element, _step, { driver: activeDriver }) => {
          const index = activeDriver.getActiveIndex();
          setActiveStepIndex(index ?? null);

          const tourId = activeTourIdRef.current;
          if (tourId && index !== undefined) {
            trackFeatureUsage("tour_step_viewed", {
              tourId,
              step: index,
              locale: i18n.language,
            });
          }
        },
      });

      return instance;
    },
    [i18n.language, stopTour, t]
  );

  const startTour = useCallback(
    (tourId: TourId, options?: { replay?: boolean }) => {
      if (driverRef.current?.isActive()) {
        destroyDriver();
      }

      if (options?.replay) {
        resetTourCompletion(tourId);
      }

      const instance = createDriverForTour(tourId);
      driverRef.current = instance;
      activeTourIdRef.current = tourId;
      setActiveTourId(tourId);
      setActiveStepIndex(0);

      trackFeatureUsage(options?.replay ? "tour_replayed" : "tour_started", {
        tourId,
        locale: i18n.language,
      });

      instance.drive();
    },
    [createDriverForTour, destroyDriver, i18n.language]
  );

  const driveToStep = useCallback((stepIndex: HistoricalTourStepIndex) => {
    if (!driverRef.current?.isActive()) {
      return;
    }

    driverRef.current.drive(stepIndex);
    setActiveStepIndex(stepIndex);
  }, []);

  const resetTour = useCallback(
    (tourId: TourId) => {
      resetTourCompletion(tourId);
    },
    []
  );

  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
      driverRef.current = null;
    };
  }, []);

  return {
    activeTourId,
    activeStepIndex,
    isTourActive: activeTourId !== null,
    isTourCompleted: (tourId: TourId) => isTourCompleted(tourId),
    startTour,
    stopTour,
    resetTour,
    driveToStep,
  };
};
