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
  getSensorAgeSeconds,
  RECENT_ACTIVITY_MAX_SECONDS,
} from "../../utils/sensorLastSeen";
import { getSourceDisplayName } from "../../utils/sourceCompatibility";
import { cn } from "../../lib/utils";
import type { MapControlsCommunitySources } from "../../contexts/mapControlsContext";

export interface MobileAirSourceDisclosureProps {
  community: MapControlsCommunitySources;
  /** Purge les parcours détenus par la carte avant de déléguer à App */
  onLoadRoute: (
    sensorId: string,
    period: { startDate: string; endDate: string }
  ) => void;
  onLoaded: () => void;
}

/**
 * Sous-groupe MobileAir du menu Sources, rangé avec les capteurs communautaires.
 *
 * Comme SignalAir : un dépliant, parce qu'activer ne suffit pas à afficher un
 * parcours — il faut choisir un capteur et une période, puis charger.
 *
 * Le brouillon (`selectedSensor`, `timeRange`) vit ici et non dans un panneau :
 * il est donc démonté à la fermeture du menu, ce qui était déjà le comportement
 * du panneau (`if (!isOpen) return null`). Le catalogue de capteurs, lui, est
 * mis en cache dans le service, si bien qu'une réouverture ne provoque aucun
 * appel réseau.
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
  } = community;

  const [selectedSensor, setSelectedSensor] = useState<string | null>(null);
  const [sensorQuery, setSensorQuery] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>({
    type: "preset",
    preset: "7d",
  });

  const { sensors, loading, error } = useMobileAirSensorCatalog();
  const availableSensors = sensors.filter((sensor) => sensor.displayMap);
  // Filtre local : le catalogue est déjà en mémoire, pas de debounce réseau.
  const normalizedQuery = sensorQuery.trim().toLowerCase();
  const filteredSensors =
    normalizedQuery.length === 0
      ? availableSensors
      : availableSensors.filter((sensor) =>
          sensor.sensorId.toLowerCase().includes(normalizedQuery)
        );
  const selectedVisible = filteredSensors.some(
    (sensor) => sensor.sensorId === selectedSensor
  );
  const label = getSourceDisplayName("communautaire.mobileair", t);
  // Un seul instant de référence par rendu, pour que la liste ne se contredise
  // pas d'une ligne à l'autre.
  const now = Date.now();

  const listRef = useRef<HTMLDivElement>(null);

  /**
   * Navigation du groupe de boutons radio.
   *
   * Un `radiogroup` ne compte que pour UN arrêt de tabulation : sans cela, le
   * catalogue — plusieurs dizaines de capteurs — obligerait à autant de `Tab`
   * pour traverser le menu. La sélection suit le focus, comme le veut le modèle
   * ARIA pour des boutons radio. Les indices portent sur la liste filtrée.
   */
  const selectSensorAt = (index: number) => {
    const sensor = filteredSensors[index];
    if (!sensor) return;
    setSelectedSensor(sensor.sensorId);
    listRef.current
      ?.querySelector<HTMLButtonElement>(`[data-sensor-index="${index}"]`)
      ?.focus();
  };

  const handleSensorKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    current: number
  ) => {
    const count = filteredSensors.length;
    if (count === 0) return;

    let next: number;
    switch (event.key) {
      case "Home":
        next = 0;
        break;
      case "End":
        next = count - 1;
        break;
      case "ArrowDown":
      case "ArrowRight":
        next = (current + 1) % count;
        break;
      case "ArrowUp":
      case "ArrowLeft":
        next = current === 0 ? count - 1 : current - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    selectSensorAt(next);
  };

  /**
   * Ancienneté en clair. Les capteurs mobiles émettent par campagnes : sans
   * cette ligne, un capteur muet depuis six mois est indiscernable d'un capteur
   * arrêté ce matin, alors que seul le second promet un parcours à charger.
   */
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

  /** Trois états, comme l'ancien panneau : « inactif » seul rangeait à tort un capteur silencieux depuis une heure avec un capteur arrêté depuis un an. */
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

  const handleLoad = () => {
    if (!selectedSensor) return;
    const { startDate, endDate } = resolveTimeRange(timeRange);
    if (!isMobileAirEnabled) onMobileAirEnabledChange(true);
    onLoadRoute(selectedSensor, { startDate, endDate });
    onLoaded();
  };

  return (
    <LayerDisclosure
      label={label}
      active={isMobileAirEnabled}
      activeLabel={t("controls.specialSourcesActive")}
      hint={
        availableSensors.length > 0 ? String(availableSensors.length) : undefined
      }
      defaultOpen={isMobileAirEnabled && !hasMobileAirData}
    >
      <div data-testid="sources-mobileair-body" className="space-y-2 pl-4 pr-1 pt-1">
        {hasMobileAirData && (
          <button
            type="button"
            data-testid="sources-mobileair-visibility"
            onClick={() => onMobileAirToggle(!isMobileAirVisible)}
            aria-pressed={isMobileAirVisible}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-black/[0.04]"
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
          {t("panels.mobileAirSelection.selectionLimitDescription")}
        </p>

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
                  // Empêche Radix/Popover de traiter les flèches et Escape
                  // comme navigation du menu pendant qu'on tape.
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
              role="radiogroup"
              aria-label={t("panels.mobileAirSelection.sensorsAvailable", {
                count: filteredSensors.length,
              })}
              className="max-h-48 space-y-1 overflow-y-auto"
            >
              {filteredSensors.map((sensor, index) => {
                const checked = selectedSensor === sensor.sensorId;
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
                    role="radio"
                    aria-checked={checked}
                    // Le nom accessible reprend la date en toutes lettres, que
                    // l'affichage abrège faute de place.
                    aria-label={[sensor.sensorId, status.label, lastActivity]
                      .filter(Boolean)
                      .join(", ")}
                    // Un seul arrêt de tabulation : le capteur coché s'il est
                    // visible, sinon le premier de la liste filtrée.
                    tabIndex={
                      checked || (!selectedVisible && index === 0) ? 0 : -1
                    }
                    data-sensor-index={index}
                    data-testid={`sources-mobileair-sensor-${sensor.sensorId}`}
                    onClick={() => setSelectedSensor(sensor.sensorId)}
                    onKeyDown={(event) => handleSensorKeyDown(event, index)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                      checked
                        ? "border-blue-300 bg-blue-50 text-[#1f3c6d]"
                        : "border-black/[0.09] bg-white text-gray-700 hover:bg-black/[0.04]"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full border",
                        checked
                          ? "border-blue-600 bg-blue-600"
                          : "border-black/20"
                      )}
                    />
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
          disabled={!selectedSensor}
          className={cn(
            "w-full rounded-md px-3 py-2 text-xs font-medium transition-colors",
            !selectedSensor
              ? "cursor-not-allowed bg-black/[0.06] text-[color:var(--fg-muted)]"
              : "bg-blue-600 text-white hover:bg-blue-700"
          )}
        >
          {selectedSensor
            ? t("panels.mobileAirSelection.loadSensorRoute", {
                sensorId: selectedSensor,
              })
            : t("panels.mobileAirSelection.selectSensor")}
        </button>

        {isMobileAirEnabled && (
          <button
            type="button"
            data-testid="sources-mobileair-disable"
            onClick={() => onMobileAirEnabledChange(false)}
            className="w-full rounded-md px-2 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            {t("controls.disableMobileAir")}
          </button>
        )}
      </div>
    </LayerDisclosure>
  );
};

export default MobileAirSourceDisclosure;
