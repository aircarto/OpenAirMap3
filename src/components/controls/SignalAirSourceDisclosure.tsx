import React from "react";
import { useTranslation } from "react-i18next";
import LayerDisclosure from "./LayerDisclosure";
import { getSourceDisplayName } from "../../utils/sourceCompatibility";
import { isMapInstantAllowedForTimeStep } from "../../utils/mapInstant";
import { cn } from "../../lib/utils";
import type { MapControlsCommunitySources } from "../../contexts/mapControlsContext";

const SIGNAL_TYPE_IDS = ["odeur", "bruit", "brulage", "visuel"] as const;

export interface SignalAirSourceDisclosureProps {
  community: MapControlsCommunitySources;
  selectedTimeStep: string;
  /** Conservé pour l’API du slot Sources ; plus de fermeture forcée au chargement */
  onLoaded?: () => void;
}

/**
 * Sous-groupe SignalAir du menu Sources.
 *
 * Activation immédiate (source classique) : cocher active la source et charge
 * les signalements sur la fenêtre TimeBar. Les types filtrents l’affichage ;
 * tout décocher désactive. Hors 15 min / heure / jour : grisé.
 * En mode mobilité MobileAir : grisé, clic = sortie du mode + réactivation.
 */
export const SignalAirSourceDisclosure: React.FC<
  SignalAirSourceDisclosureProps
> = ({ community, selectedTimeStep }) => {
  const { t } = useTranslation();

  const {
    isSignalAirEnabled,
    onSignalAirEnabledChange,
    isSignalAirVisible,
    onSignalAirToggle,
    hasSignalAirData,
    signalAirSelectedTypes,
    onSignalAirTypesChange,
    isSignalAirLoading,
    signalAirHasLoaded,
    signalAirReportsCount,
    isMobileAirMobilityMode,
    onExitMobilityModeViaSignalAir,
  } = community;

  const compatible = isMapInstantAllowedForTimeStep(selectedTimeStep);
  const label = getSourceDisplayName("signalair", t);
  const allTypesSelected =
    signalAirSelectedTypes.length === SIGNAL_TYPE_IDS.length;
  const mutedByMobility = isMobileAirMobilityMode;

  const handleEnableToggle = () => {
    if (mutedByMobility) {
      onExitMobilityModeViaSignalAir();
      return;
    }
    if (!compatible) return;
    if (isSignalAirEnabled) {
      onSignalAirEnabledChange(false);
      return;
    }
    if (signalAirSelectedTypes.length === 0) {
      onSignalAirTypesChange([...SIGNAL_TYPE_IDS]);
    }
    onSignalAirEnabledChange(true);
  };

  const handleTypeToggle = (id: string) => {
    if (mutedByMobility) {
      onExitMobilityModeViaSignalAir();
      return;
    }
    if (!compatible) return;
    const next = signalAirSelectedTypes.includes(id)
      ? signalAirSelectedTypes.filter((type) => type !== id)
      : [...signalAirSelectedTypes, id];
    onSignalAirTypesChange(next);
  };

  return (
    <LayerDisclosure
      label={label}
      active={isSignalAirEnabled && !mutedByMobility}
      activeLabel={t("controls.specialSourcesActive")}
      hint={
        signalAirHasLoaded && isSignalAirEnabled && !mutedByMobility
          ? String(signalAirReportsCount)
          : undefined
      }
      defaultOpen={isSignalAirEnabled && !signalAirHasLoaded}
    >
      <div
        data-testid="sources-signalair-body"
        className={cn(
          "space-y-2 pl-4 pr-1 pt-1",
          (!compatible || mutedByMobility) && "opacity-50"
        )}
      >
        {mutedByMobility ? (
          <p
            data-testid="sources-signalair-mobility-hint"
            className="px-2 text-xs text-[color:var(--fg-muted)]"
          >
            {t("controls.mobilityModeHint")}
          </p>
        ) : null}
        {!compatible && !mutedByMobility ? (
          <p
            data-testid="sources-signalair-incompatible"
            className="px-2 text-xs text-[color:var(--fg-muted)]"
          >
            {t("panels.signalAirSelection.incompatibleTimeStep")}
          </p>
        ) : null}

        <button
          type="button"
          data-testid="sources-signalair-enable"
          role="checkbox"
          aria-checked={isSignalAirEnabled && !mutedByMobility}
          aria-disabled={!compatible && !mutedByMobility}
          disabled={!compatible && !mutedByMobility}
          onClick={handleEnableToggle}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            compatible || mutedByMobility
              ? "text-gray-700 hover:bg-black/[0.04]"
              : "cursor-not-allowed text-[color:var(--fg-muted)]"
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
              isSignalAirEnabled && !mutedByMobility
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-300 bg-white"
            )}
          >
            {isSignalAirEnabled && !mutedByMobility ? (
              <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2.5 6.5L5 9l4.5-5.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </span>
          {t("panels.signalAirSelection.enable")}
        </button>

        {hasSignalAirData && !mutedByMobility ? (
          <button
            type="button"
            data-testid="sources-signalair-visibility"
            onClick={() => onSignalAirToggle(!isSignalAirVisible)}
            aria-pressed={isSignalAirVisible}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-black/[0.04]"
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                isSignalAirVisible
                  ? "bg-[color:var(--fg-ok)]"
                  : "bg-gray-300"
              )}
            />
            {isSignalAirVisible
              ? t("panels.hideSignalAirAria")
              : t("panels.showSignalAirAria")}
          </button>
        ) : null}

        <div
          role="group"
          aria-label={t("panels.signalAirSelection.typesTitle", {
            selected: signalAirSelectedTypes.length,
            total: SIGNAL_TYPE_IDS.length,
          })}
        >
          <div className="mb-1.5 flex items-center justify-between px-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[color:var(--fg-muted)]">
              {t("panels.signalAirSelection.typesShort")}
            </span>
            <button
              type="button"
              disabled={!compatible && !mutedByMobility}
              onClick={() => {
                if (mutedByMobility) {
                  onExitMobilityModeViaSignalAir();
                  return;
                }
                onSignalAirTypesChange(
                  allTypesSelected ? [] : [...SIGNAL_TYPE_IDS]
                );
              }}
              className="text-[10px] font-medium text-blue-600 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {allTypesSelected
                ? t("panels.signalAirSelection.deselectAll")
                : t("panels.signalAirSelection.selectAll")}
            </button>
          </div>
          <div className="flex flex-wrap gap-1 px-1">
            {SIGNAL_TYPE_IDS.map((id) => {
              const checked = signalAirSelectedTypes.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  data-testid={`sources-signalair-type-${id}`}
                  role="checkbox"
                  aria-checked={checked && !mutedByMobility}
                  disabled={!compatible && !mutedByMobility}
                  onClick={() => handleTypeToggle(id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                    checked && !mutedByMobility
                      ? "border-blue-400/80 bg-blue-50 text-[#1f3c6d]"
                      : "border-transparent bg-black/[0.04] text-gray-600 hover:bg-black/[0.07]",
                    !compatible && !mutedByMobility && "cursor-not-allowed"
                  )}
                >
                  <img
                    src={`/markers/signalAirMarkers/${
                      id === "bruit" ? "bruits" : id
                    }.png`}
                    alt=""
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0 object-contain opacity-90"
                  />
                  <span>
                    {t(`panels.signalAirSelection.types.${id}.label`)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {isSignalAirLoading ? (
          <p className="px-2 text-xs text-[color:var(--fg-muted)]">
            {t("panels.loadingInProgress")}
          </p>
        ) : null}
      </div>
    </LayerDisclosure>
  );
};

export default SignalAirSourceDisclosure;
