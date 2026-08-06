import { useEffect, useRef } from "react";
import { useFeatureTourContext } from "./featureTourContext";

// Doit correspondre au seuil `xl` de Tailwind utilisé par la barre d'outils desktop dans App.tsx
const DESKTOP_MIN_WIDTH = 1280;
const AUTO_START_DELAY_MS = 900;

const GlobalAppTourController: React.FC = () => {
  const { isTourActive, isTourCompleted, startTour } = useFeatureTourContext();
  const hasAutoStartedRef = useRef(false);

  useEffect(() => {
    if (
      hasAutoStartedRef.current ||
      isTourCompleted("app_overview") ||
      isTourActive ||
      typeof window === "undefined" ||
      window.innerWidth < DESKTOP_MIN_WIDTH
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      hasAutoStartedRef.current = true;
      startTour("app_overview");
    }, AUTO_START_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isTourActive, isTourCompleted, startTour]);

  return null;
};

export default GlobalAppTourController;
