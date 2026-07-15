import { useCallback, useState } from "react";

export const SENSOR_PROMO_DISMISS_KEY = "openairmap-sensor-promo-dismissed";

export const isSensorPromoDismissed = (): boolean => {
  if (typeof sessionStorage === "undefined") {
    return false;
  }

  try {
    return sessionStorage.getItem(SENSOR_PROMO_DISMISS_KEY) === "true";
  } catch {
    return false;
  }
};

export const dismissSensorPromo = (): void => {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  try {
    sessionStorage.setItem(SENSOR_PROMO_DISMISS_KEY, "true");
  } catch {
    // sessionStorage indisponible (mode privé, quota, etc.)
  }
};

export const useSensorPromoDismiss = () => {
  const [isDismissed, setIsDismissed] = useState(isSensorPromoDismissed);

  const dismiss = useCallback(() => {
    dismissSensorPromo();
    setIsDismissed(true);
  }, []);

  return { isDismissed, dismiss };
};
