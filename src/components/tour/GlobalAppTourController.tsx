import { useEffect, useRef } from "react";
import { useFeatureTourContext } from "./featureTourContext";

// Le démarrage automatique est réservé aux largeurs où le rail est vertical et où
// la légende — cible de la dernière étape — est affichée : celle-ci vit dans la
// colonne bas-droite en `hidden lg:flex`, d'où le seuil `lg` et non `md`. Le tour
// reste rejouable à la main sous ce seuil depuis le pied du rail.
const DESKTOP_MIN_WIDTH = 1024;
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
