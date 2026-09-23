import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MobileAirRoute } from "../../types";
import HistoricalTimeRangeSelector from "../controls/HistoricalTimeRangeSelector";
import {
  resolveTimeRange,
  type TimeRange,
} from "../../utils/historicalTimeRange";
import { cn } from "../../lib/utils";
import type { MobileAirSensorStatus } from "../../constants/mobileAir";

export interface MobileAirManageSectionProps {
  sensorIds: string[];
  allRoutes: MobileAirRoute[];
  sensorVisibility: Record<string, boolean>;
  sensorStatus: Record<string, MobileAirSensorStatus>;
  sensorPeriods: Record<string, { startDate: string; endDate: string }>;
  defaultPeriod: { startDate: string; endDate: string };
  focusRoute: MobileAirRoute | null;
  isSessionOnMap: (route: MobileAirRoute) => boolean;
  onSensorVisibilityChange: (sensorId: string, visible: boolean) => void;
  onSensorRemove: (sensorId: string) => void;
  onSensorPeriodChange: (
    sensorId: string,
    period: { startDate: string; endDate: string }
  ) => void;
  onToggleSessionOnMap: (route: MobileAirRoute, visible: boolean) => void;
  onSetSensorSessionsVisible: (sensorId: string, visible: boolean) => void;
  onFocusRoute: (route: MobileAirRoute) => void;
}

const statusTone = (status: MobileAirSensorStatus | undefined): string => {
  switch (status) {
    case "loading":
      return "text-amber-600";
    case "error":
      return "text-red-600";
    case "ready":
      return "text-emerald-600";
    default:
      return "text-[color:var(--fg-muted)]";
  }
};

/**
 * Liste des capteurs MobileAir chargés : visibilité, période, sessions carte.
 * Chaque session est librement cochable pour composer l'affichage carte.
 */
export const MobileAirManageSection: React.FC<MobileAirManageSectionProps> = ({
  sensorIds,
  allRoutes,
  sensorVisibility,
  sensorStatus,
  sensorPeriods,
  defaultPeriod,
  focusRoute,
  isSessionOnMap,
  onSensorVisibilityChange,
  onSensorRemove,
  onSensorPeriodChange,
  onToggleSessionOnMap,
  onSetSensorSessionsVisible,
  onFocusRoute,
}) => {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(
    sensorIds[0] ?? null
  );

  if (sensorIds.length === 0) return null;

  return (
    <div
      data-testid="mobileair-manage-section"
      className="border border-[rgb(16_32_56_/_0.09)] rounded-[var(--r-md)] p-3 sm:p-4 space-y-2"
    >
      <h3 className="text-sm font-medium text-[color:var(--fg-muted)] text-center">
        {t("panels.mobileAirManage.title", { count: sensorIds.length })}
      </h3>

      <ul className="space-y-2">
        {sensorIds.map((sensorId) => {
          const expanded = expandedId === sensorId;
          const visible = sensorVisibility[sensorId] !== false;
          const status = sensorStatus[sensorId] ?? "idle";
          const period = sensorPeriods[sensorId] ?? defaultPeriod;
          const sensorRoutes = allRoutes
            .filter((r) => r.sensorId === sensorId)
            .sort(
              (a, b) =>
                new Date(b.startTime).getTime() -
                new Date(a.startTime).getTime()
            );
          const onMapCount = sensorRoutes.filter((r) =>
            isSessionOnMap(r)
          ).length;

          return (
            <li
              key={sensorId}
              className="rounded-[var(--r-md)] border border-[rgb(16_32_56_/_0.09)] bg-white/60"
            >
              <div className="flex items-center gap-1 p-2">
                <button
                  type="button"
                  className="min-h-11 min-w-11 flex items-center justify-center rounded-md text-[color:var(--fg-muted)] hover:bg-black/[0.04]"
                  aria-expanded={expanded}
                  aria-label={t("panels.mobileAirManage.expandSensor", {
                    sensorId,
                  })}
                  onClick={() =>
                    setExpandedId((prev) =>
                      prev === sensorId ? null : sensorId
                    )
                  }
                >
                  <svg
                    className={cn(
                      "h-4 w-4 transition-transform",
                      expanded && "rotate-90"
                    )}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[color:var(--fg)]">
                    {sensorId}
                  </div>
                  <div className={cn("text-[10px]", statusTone(status))}>
                    {t(`panels.mobileAirManage.status.${status}`)}
                    {sensorRoutes.length > 0 && (
                      <span className="text-[color:var(--fg-muted)]">
                        {" · "}
                        {t("panels.mobileAirManage.onMapCount", {
                          count: onMapCount,
                          total: sensorRoutes.length,
                        })}
                      </span>
                    )}
                    {status === "loading" && (
                      <span
                        aria-hidden="true"
                        className="ml-1 inline-block h-2.5 w-2.5 animate-spin rounded-full border border-amber-500 border-t-transparent align-middle"
                      />
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="min-h-11 min-w-11 flex items-center justify-center rounded-md hover:bg-black/[0.04]"
                  aria-pressed={visible}
                  aria-label={
                    visible
                      ? t("panels.mobileAirManage.hideSensor", { sensorId })
                      : t("panels.mobileAirManage.showSensor", { sensorId })
                  }
                  onClick={() =>
                    onSensorVisibilityChange(sensorId, !visible)
                  }
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-2 w-2 rounded-full",
                      visible ? "bg-[color:var(--fg-ok)]" : "bg-gray-300"
                    )}
                  />
                </button>

                <button
                  type="button"
                  className="min-h-11 min-w-11 flex items-center justify-center rounded-md text-red-600 hover:bg-red-50"
                  aria-label={t("panels.mobileAirManage.removeSensor", {
                    sensorId,
                  })}
                  onClick={() => onSensorRemove(sensorId)}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              </div>

              {expanded && (
                <div className="space-y-3 border-t border-[rgb(16_32_56_/_0.06)] px-3 pb-3 pt-2">
                  <div>
                    <p className="mb-1 text-[10px] font-medium text-[color:var(--fg-muted)]">
                      {t("panels.mobileAirManage.periodLabel")}
                    </p>
                    <SensorPeriodEditor
                      period={period}
                      onApply={(next) => onSensorPeriodChange(sensorId, next)}
                      isLoading={status === "loading"}
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[10px] font-medium text-[color:var(--fg-muted)]">
                        {t("panels.mobileAirManage.sessionsOnMap", {
                          count: sensorRoutes.length,
                        })}
                      </p>
                      {sensorRoutes.length > 0 && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="min-h-9 rounded px-2 text-[10px] font-medium text-blue-700 hover:bg-blue-50"
                            onClick={() =>
                              onSetSensorSessionsVisible(sensorId, true)
                            }
                          >
                            {t("panels.mobileAirManage.selectAllSessions")}
                          </button>
                          <button
                            type="button"
                            className="min-h-9 rounded px-2 text-[10px] font-medium text-[color:var(--fg-muted)] hover:bg-black/[0.04]"
                            onClick={() =>
                              onSetSensorSessionsVisible(sensorId, false)
                            }
                          >
                            {t("panels.mobileAirManage.selectNoSessions")}
                          </button>
                        </div>
                      )}
                    </div>
                    {sensorRoutes.length === 0 ? (
                      <p className="text-xs text-[color:var(--fg-muted)]">
                        {status === "error"
                          ? t("panels.mobileAirManage.sensorError")
                          : t("panels.mobileAirManage.noSessions")}
                      </p>
                    ) : (
                      <ul className="max-h-40 space-y-1 overflow-y-auto">
                        {sensorRoutes.map((route) => {
                          const onMap = isSessionOnMap(route);
                          const isFocus =
                            focusRoute?.sensorId === route.sensorId &&
                            focusRoute?.sessionId === route.sessionId;
                          return (
                            <li
                              key={`${route.sensorId}-${route.sessionId}`}
                              className={cn(
                                "flex items-center gap-2 rounded-md border px-2 py-1.5",
                                isFocus
                                  ? "border-blue-400 bg-blue-50"
                                  : "border-[rgb(16_32_56_/_0.09)]"
                              )}
                            >
                              <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  checked={onMap}
                                  onChange={(e) =>
                                    onToggleSessionOnMap(
                                      route,
                                      e.target.checked
                                    )
                                  }
                                  aria-label={t(
                                    "panels.mobileAirManage.toggleSessionMap",
                                    { sessionId: route.sessionId }
                                  )}
                                />
                              </label>
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-left text-xs"
                                onClick={() => onFocusRoute(route)}
                              >
                                <span className="font-medium text-[color:var(--fg)]">
                                  {t("panels.mobileAirDetail.sessionLabel", {
                                    sessionId: route.sessionId,
                                  })}
                                  {isFocus && (
                                    <span className="ml-1 text-[10px] text-blue-600">
                                      (
                                      {t(
                                        "panels.mobileAirManage.detailFocusBadge"
                                      )}
                                      )
                                    </span>
                                  )}
                                </span>
                                <span className="block text-[10px] text-[color:var(--fg-muted)]">
                                  {new Date(route.startTime).toLocaleString()}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const SensorPeriodEditor: React.FC<{
  period: { startDate: string; endDate: string };
  onApply: (period: { startDate: string; endDate: string }) => void;
  isLoading: boolean;
}> = ({ period, onApply, isLoading }) => {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<TimeRange>(() => ({
    type: "custom",
    custom: {
      startDate: period.startDate.slice(0, 10),
      endDate: period.endDate.slice(0, 10),
    },
  }));

  return (
    <div className="space-y-2">
      <HistoricalTimeRangeSelector
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        customRangePresentation="inline"
      />
      <button
        type="button"
        disabled={isLoading}
        className={cn(
          "min-h-11 w-full rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          isLoading
            ? "cursor-not-allowed bg-black/[0.06] text-[color:var(--fg-muted)]"
            : "bg-blue-600 text-white hover:bg-blue-700"
        )}
        onClick={() => {
          const resolved = resolveTimeRange(timeRange);
          onApply(resolved);
        }}
      >
        {t("panels.mobileAirManage.applyPeriod")}
      </button>
    </div>
  );
};

export default MobileAirManageSection;
