import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import LayerDisclosure from "./LayerDisclosure";
import HistoricalTimeRangeSelector from "./HistoricalTimeRangeSelector";
import { useMobileAirSensorCatalog } from "../map/hooks/useMobileAirSensorCatalog";
import {
  resolveTimeRange,
  type TimeRange,
} from "../../utils/historicalTimeRange";
import {
  compareSensorsByActivity,
  getSensorAgeSeconds,
  RECENT_ACTIVITY_MAX_SECONDS,
} from "../../utils/sensorLastSeen";
import { getSourceDisplayName } from "../../utils/sourceCompatibility";
import { cn } from "../../lib/utils";
import { MAX_MOBILE_AIR_SENSORS } from "../../constants/mobileAir";
import type { MapControlsCommunitySources } from "../../contexts/mapControlsContext";

export interface MobileAirSourceDisclosureProps {
  community: MapControlsCommunitySources;
  /** Purge les parcours détenus par la carte avant de déléguer à App */
  onLoadRoute: (
    sensorIds: string[],
    period: { startDate: string; endDate: string }
  ) => void;
  onLoaded: () => void;
}

/**
 * Sous-groupe MobileAir du menu Sources.
 *
 * Multi-sélection plafonnée (MAX_MOBILE_AIR_SENSORS) : brouillon local puis
 * « Charger » qui remplace l'ensemble chargé. Décocher un capteur déjà chargé
 * le retire immédiatement de la carte.
 */
export const MobileAirSourceDisclosure: React.FC<
  MobileAirSourceDisclosureProps
> = ({ community, onLoadRoute, onLoaded }) => {
  const { t } = useTranslation();
  const {
    isMobileAirEnabled,
    onMobileAirEnabledChange,
    isMobileAirVisible,
    onMobileAirToggle,
    hasMobileAirData,
    selectedMobileAirSensors,
    onMobileAirSensorRemove,
    isMobileAirLoading,
  } = community;

  const [selectedSensors, setSelectedSensors] = useState<string[]>(
    () => selectedMobileAirSensors
  );

  // Garder le brouillon aligné sur les capteurs déjà chargés (réouverture menu)
  React.useEffect(() => {
    setSelectedSensors(selectedMobileAirSensors);
  }, [selectedMobileAirSensors]);
  const [sensorQuery, setSensorQuery] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>({
    type: "preset",
    preset: "7d",
  });

  const { sensors, loading, error } = useMobileAirSensorCatalog();
  const now = Date.now();
  const availableSensors = sensors
    .filter((sensor) => sensor.displayMap)
    .sort((a, b) => compareSensorsByActivity(a, b, now));
  const normalizedQuery = sensorQuery.trim().toLowerCase();
  const filteredSensors =
    normalizedQuery.length === 0
      ? availableSensors
      : availableSensors.filter((sensor) =>
          sensor.sensorId.toLowerCase().includes(normalizedQuery)
        );
  const label = getSourceDisplayName("communautaire.mobileair", t);
  const atLimit = selectedSensors.length >= MAX_MOBILE_AIR_SENSORS;
  const listRef = useRef<HTMLDivElement>(null);

  const formatLastSeen = (ageSeconds: number | null): string | null => {
    if (ageSeconds === null) return null;

    const minutes = Math.floor(ageSeconds / 60);
    if (minutes < 1) return t("panels.mobileAirSelection.lastSeenNow");

    const hours = Math.floor(minutes / 60);
    if (hours < 1) {
      return t("panels.mobileAirSelection.lastSeenMinutes", { count: minutes });
    }

    const days = Math.floor(hours / 24);
    if (days < 1) {
      return t("panels.mobileAirSelection.lastSeenHours", { count: hours });
    }

    return t("panels.mobileAirSelection.lastSeenDays", { count: days });
  };

  const getSensorStatus = (
    connected: boolean,
    ageSeconds: number | null
  ): { label: string; tone: string } => {
    if (connected) {
      return {
        label: t("panels.mobileAirSelection.statusConnected"),
        tone: "text-emerald-600",
      };
    }
    if (ageSeconds !== null && ageSeconds < RECENT_ACTIVITY_MAX_SECONDS) {
      return {
        label: t("panels.mobileAirSelection.statusRecent"),
        tone: "text-amber-600",
      };
    }
    return {
      label: t("panels.mobileAirSelection.statusInactive"),
      tone: "text-gray-400",
    };
  };

  const handleToggleSensor = (sensorId: string) => {
    const isSelected = selectedSensors.includes(sensorId);
    if (isSelected) {
      setSelectedSensors((prev) => prev.filter((id) => id !== sensorId));
      // Retrait immédiat si déjà chargé
      if (selectedMobileAirSensors.includes(sensorId)) {
        onMobileAirSensorRemove(sensorId);
      }
      return;
    }
    if (atLimit) return;
    setSelectedSensors((prev) => [...prev, sensorId]);
  };

  const handleLoad = () => {
    if (selectedSensors.length === 0) return;
    const { startDate, endDate } = resolveTimeRange(timeRange);
    if (!isMobileAirEnabled) onMobileAirEnabledChange(true);
    onLoadRoute(selectedSensors, { startDate, endDate });
    onLoaded();
  };

  const loadedCount = selectedMobileAirSensors.length;

  return (
    <LayerDisclosure
      label={label}
      active={isMobileAirEnabled}
      activeLabel={t("controls.specialSourcesActive")}
      hint={
        isMobileAirEnabled && loadedCount > 0
          ? t("panels.mobileAirSelection.loadedHint", {
              count: loadedCount,
              max: MAX_MOBILE_AIR_SENSORS,
            })
          : availableSensors.length > 0
            ? String(availableSensors.length)
            : undefined
      }
      defaultOpen={isMobileAirEnabled && !hasMobileAirData}
    >
      <div
        data-testid="sources-mobileair-body"
        className="space-y-2 pl-4 pr-1 pt-1"
      >
        {hasMobileAirData && (
          <button
            type="button"
            data-testid="sources-mobileair-visibility"
            onClick={() => onMobileAirToggle(!isMobileAirVisible)}
            aria-pressed={isMobileAirVisible}
            className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-black/[0.04]"
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                isMobileAirVisible ? "bg-[color:var(--fg-ok)]" : "bg-gray-300"
              )}
            />
            {isMobileAirVisible
              ? t("panels.hideMobileAirAria")
              : t("panels.showMobileAirAria")}
          </button>
        )}

        <p className="px-2 text-xs text-[color:var(--fg-muted)]">
          {t("panels.mobileAirSelection.selectionLimitDescription", {
            max: MAX_MOBILE_AIR_SENSORS,
          })}
        </p>

        {isMobileAirLoading && (
          <p
            data-testid="sources-mobileair-loading"
            className="flex items-center gap-2 px-2 text-xs text-[color:var(--fg-muted)]"
          >
            <span
              aria-hidden="true"
              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
            />
            {t("panels.mobileAirSelection.loadingSensors")}
          </p>
        )}

        {loading && (
          <p className="px-2 text-xs text-[color:var(--fg-muted)]">
            {t("panels.loadSensors")}
          </p>
        )}
        {error && (
          <p className="px-2 text-xs text-red-600">
            {t(`panels.mobileAirSelection.${error}`)}
          </p>
        )}

        {!loading && !error && (
          <div className="space-y-1.5">
            <p className="px-0.5 text-[10px] font-medium text-[color:var(--fg-muted)]">
              {t("panels.mobileAirSelection.selectionCounter", {
                count: selectedSensors.length,
                max: MAX_MOBILE_AIR_SENSORS,
              })}
            </p>

            {availableSensors.length > 0 && (
              <label className="block px-0.5">
                <span className="sr-only">
                  {t("panels.mobileAirSelection.searchPlaceholder")}
                </span>
                <input
                  type="search"
                  data-testid="sources-mobileair-search"
                  value={sensorQuery}
                  onChange={(event) => setSensorQuery(event.target.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                  placeholder={t(
                    "panels.mobileAirSelection.searchPlaceholder"
                  )}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full rounded-md border border-black/[0.09] bg-white px-2 py-1.5 text-xs text-gray-700 placeholder:text-[color:var(--fg-muted)] outline-none transition-colors focus:border-blue-300 focus:ring-1 focus:ring-blue-300"
                />
              </label>
            )}

            <div
              ref={listRef}
              role="group"
              aria-label={t("panels.mobileAirSelection.sensorsAvailable", {
                count: filteredSensors.length,
              })}
              className="max-h-48 space-y-1 overflow-y-auto"
            >
              {filteredSensors.map((sensor) => {
                const checked = selectedSensors.includes(sensor.sensorId);
                const disabled = !checked && atLimit;
                const ageSeconds = getSensorAgeSeconds(sensor, now);
                const status = getSensorStatus(sensor.connected, ageSeconds);
                const lastSeen = formatLastSeen(ageSeconds);
                const lastActivity = lastSeen
                  ? t("panels.mobileAirSelection.lastActivity", {
                      value: lastSeen,
                    })
                  : null;
                return (
                  <button
                    key={sensor.sensorId}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-disabled={disabled}
                    disabled={disabled}
                    aria-label={[sensor.sensorId, status.label, lastActivity]
                      .filter(Boolean)
                      .join(", ")}
                    data-testid={`sources-mobileair-sensor-${sensor.sensorId}`}
                    onClick={() => handleToggleSensor(sensor.sensorId)}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                      checked
                        ? "border-blue-300 bg-blue-50 text-[#1f3c6d]"
                        : disabled
                          ? "cursor-not-allowed border-black/[0.06] bg-black/[0.02] text-[color:var(--fg-muted)] opacity-60"
                          : "border-black/[0.09] bg-white text-gray-700 hover:bg-black/[0.04]"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                        checked
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-black/20"
                      )}
                    >
                      {checked && (
                        <svg
                          className="h-2.5 w-2.5"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{sensor.sensorId}</span>
                      {lastSeen && (
                        <span className="block truncate text-[10px] text-[color:var(--fg-muted)]">
                          {lastSeen}
                        </span>
                      )}
                    </span>
                    <span className={cn("shrink-0 text-[10px]", status.tone)}>
                      {status.label}
                    </span>
                  </button>
                );
              })}
              {availableSensors.length === 0 && (
                <p className="px-2 text-xs text-[color:var(--fg-muted)]">
                  {t("panels.mobileAirSelection.sensorsAvailable", {
                    count: 0,
                  })}
                </p>
              )}
              {availableSensors.length > 0 && filteredSensors.length === 0 && (
                <p
                  data-testid="sources-mobileair-search-empty"
                  className="px-2 text-xs text-[color:var(--fg-muted)]"
                >
                  {t("panels.mobileAirSelection.noSearchResults", {
                    query: sensorQuery.trim(),
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        <HistoricalTimeRangeSelector
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          customRangePresentation="inline"
        />

        <button
          type="button"
          data-testid="sources-mobileair-load"
          onClick={handleLoad}
          disabled={selectedSensors.length === 0 || isMobileAirLoading}
          className={cn(
            "min-h-11 w-full rounded-md px-3 py-2 text-xs font-medium transition-colors",
            selectedSensors.length === 0 || isMobileAirLoading
              ? "cursor-not-allowed bg-black/[0.06] text-[color:var(--fg-muted)]"
              : "bg-blue-600 text-white hover:bg-blue-700"
          )}
        >
          {selectedSensors.length === 0
            ? t("panels.mobileAirSelection.selectSensor")
            : t("panels.mobileAirSelection.loadSensorsRoutes", {
                count: selectedSensors.length,
              })}
        </button>

        {isMobileAirEnabled && (
          <button
            type="button"
            data-testid="sources-mobileair-disable"
            onClick={() => onMobileAirEnabledChange(false)}
            className="min-h-11 w-full rounded-md px-2 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            {t("controls.disableMobileAir")}
          </button>
        )}
      </div>
    </LayerDisclosure>
  );
};

export default MobileAirSourceDisclosure;
