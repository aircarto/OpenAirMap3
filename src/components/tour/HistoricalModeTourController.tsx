import { useEffect, useRef } from "react";
import { useFeatureTourContext } from "./featureTourContext";

interface HistoricalModeTourControllerProps {
  isHistoricalModeAllowed: boolean;
}

/**
 * Tutoriel TimeBar : démarrage automatique au premier passage sur un pas
 * de temps qui l'affiche (15 min / heure / jour).
 */
const HistoricalModeTourController: React.FC<
  HistoricalModeTourControllerProps
> = ({ isHistoricalModeAllowed }) => {
  const { isTourActive, isTourCompleted, startTour } = useFeatureTourContext();
  const hasAutoStartedRef = useRef(false);

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

  return null;
};

export default HistoricalModeTourController;
