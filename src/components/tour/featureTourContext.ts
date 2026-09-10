import { createContext, useContext } from "react";
import type { UseFeatureTourResult } from "../../hooks/useFeatureTour";

export const FeatureTourContext = createContext<UseFeatureTourResult | null>(
  null
);

export const useFeatureTourContext = (): UseFeatureTourResult => {
  const context = useContext(FeatureTourContext);
  if (!context) {
    throw new Error("useFeatureTourContext must be used within FeatureTourProvider");
  }

  return context;
};
