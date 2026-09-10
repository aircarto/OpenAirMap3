import { useEffect, useRef } from "react";
import { HISTORICAL_TOUR_STEP } from "../../config/tours/types";
import { useFeatureTourContext } from "./featureTourContext";

interface HistoricalModeTourControllerProps {
  isHistoricalModeAllowed: boolean;
  isHistoricalModeActive: boolean;
  hasHistoricalData: boolean;
  isDatePanelVisible: boolean;
}

const HistoricalModeTourController: React.FC<
  HistoricalModeTourControllerProps
> = ({
  isHistoricalModeAllowed,
  isHistoricalModeActive,
  hasHistoricalData,
  isDatePanelVisible,
}) => {
  const {
    activeTourId,
    activeStepIndex,
    isTourActive,
    isTourCompleted,
    startTour,
    driveToStep,
  } = useFeatureTourContext();

  const hasAutoStartedRef = useRef(false);
  const previousHistoricalActiveRef = useRef(false);
  const previousHasDataRef = useRef(false);

  useEffect(() => {
    if (
      hasAutoStartedRef.current ||
      !isHistoricalModeAllowed ||
      isTourCompleted("historical_mode") ||
      isTourActive
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      hasAutoStartedRef.current = true;
      startTour("historical_mode");
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [isHistoricalModeAllowed, isTourActive, isTourCompleted, startTour]);

  useEffect(() => {
    if (activeTourId !== "historical_mode" || activeStepIndex === null) {
      return;
    }

    const wasActive = previousHistoricalActiveRef.current;
    previousHistoricalActiveRef.current = isHistoricalModeActive;

    if (
      !wasActive &&
      isHistoricalModeActive &&
      activeStepIndex <= HISTORICAL_TOUR_STEP.activation
    ) {
      const timeoutId = window.setTimeout(() => {
        driveToStep(HISTORICAL_TOUR_STEP.dateSelection);
      }, 300);
      return () => window.clearTimeout(timeoutId);
    }
  }, [
    activeTourId,
    activeStepIndex,
    driveToStep,
    isHistoricalModeActive,
  ]);

  useEffect(() => {
    if (activeTourId !== "historical_mode") {
      return;
    }

    const hadData = previousHasDataRef.current;
    previousHasDataRef.current = hasHistoricalData;

    if (
      !hadData &&
      hasHistoricalData &&
      activeStepIndex !== null &&
      activeStepIndex <= HISTORICAL_TOUR_STEP.loadData
    ) {
      const timeoutId = window.setTimeout(() => {
        driveToStep(HISTORICAL_TOUR_STEP.playback);
      }, 500);
      return () => window.clearTimeout(timeoutId);
    }
  }, [activeStepIndex, activeTourId, driveToStep, hasHistoricalData]);

  useEffect(() => {
    if (
      activeTourId !== "historical_mode" ||
      activeStepIndex !== HISTORICAL_TOUR_STEP.dateSelection ||
      !isDatePanelVisible
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      driveToStep(HISTORICAL_TOUR_STEP.dateSelection);
    }, 100);

    return () => window.clearTimeout(timeoutId);
  }, [activeStepIndex, activeTourId, driveToStep, isDatePanelVisible]);

  return null;
};

export default HistoricalModeTourController;
