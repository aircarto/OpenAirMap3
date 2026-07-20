import { useCallback, useEffect, useRef } from "react";
import {
  AppUrlDefaults,
  AppUrlParams,
  areAppUrlParamsEqual,
  buildAppUrl,
  parseAppUrlParams,
} from "../utils/appUrlParams";

const URL_SYNC_DEBOUNCE_MS = 300;

interface UseAppUrlSyncParams {
  state: AppUrlParams;
  defaults: AppUrlDefaults;
  onPopState: (params: AppUrlParams) => void;
  initialMapViewTouched?: boolean;
}

interface UseAppUrlSyncResult {
  markMapViewTouched: () => void;
}

export const useAppUrlSync = ({
  state,
  defaults,
  onPopState,
  initialMapViewTouched = false,
}: UseAppUrlSyncParams): UseAppUrlSyncResult => {
  const mapViewTouchedRef = useRef(initialMapViewTouched);
  const isApplyingFromUrlRef = useRef(false);
  const lastSyncedParamsRef = useRef<AppUrlParams | null>(null);
  const onPopStateRef = useRef(onPopState);

  useEffect(() => {
    onPopStateRef.current = onPopState;
  }, [onPopState]);

  const markMapViewTouched = useCallback(() => {
    mapViewTouchedRef.current = true;
  }, []);

  useEffect(() => {
    if (isApplyingFromUrlRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextUrl = buildAppUrl(state, {
        defaults,
        includeMapView: mapViewTouchedRef.current,
      });
      const currentUrl = `${window.location.pathname}${window.location.search}`;

      if (nextUrl === currentUrl) {
        lastSyncedParamsRef.current = state;
        return;
      }

      if (
        lastSyncedParamsRef.current &&
        areAppUrlParamsEqual(lastSyncedParamsRef.current, state)
      ) {
        return;
      }

      window.history.replaceState(window.history.state, "", nextUrl);
      lastSyncedParamsRef.current = state;
    }, URL_SYNC_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [state, defaults]);

  useEffect(() => {
    const handlePopState = () => {
      isApplyingFromUrlRef.current = true;

      const parsedParams = parseAppUrlParams(window.location.search, defaults);
      lastSyncedParamsRef.current = parsedParams;
      onPopStateRef.current(parsedParams);

      window.setTimeout(() => {
        isApplyingFromUrlRef.current = false;
      }, 0);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [defaults]);

  return { markMapViewTouched };
};
