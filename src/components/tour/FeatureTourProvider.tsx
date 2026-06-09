import React from "react";
import { useFeatureTour } from "../../hooks/useFeatureTour";
import { FeatureTourContext } from "./featureTourContext";

export const FeatureTourProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const tour = useFeatureTour();

  return (
    <FeatureTourContext.Provider value={tour}>{children}</FeatureTourContext.Provider>
  );
};
