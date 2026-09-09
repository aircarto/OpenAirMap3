import React from "react";
import { useTranslation } from "react-i18next";
import LayerDisclosure from "./LayerDisclosure";
import SignalAirPeriodSelector from "./SignalAirPeriodSelector";
import { getSourceDisplayName } from "../../utils/sourceCompatibility";
import { cn } from "../../lib/utils";
import type { MapControlsCommunitySources } from "../../contexts/mapControlsContext";

const SIGNAL_TYPE_IDS = ["odeur", "bruit", "brulage", "visuel"] as const;

export interface SignalAirSourceDisclosureProps {
  community: MapControlsCommunitySources;
  /** Le menu se referme après un chargement : voir onLoaded */
  onLoaded: () => void;
}

/**
 * Sous-groupe SignalAir du menu Sources.
 *
 * Un dépliant et non une case à cocher : une case promet un changement immédiat
 * et réversible, or activer SignalAir n'affiche rien tant qu'un jeu de types et
 * une période n'ont pas été validés par un chargement. Le dépliant énonce qu'il
 * y a une étape.
 *
 * Trois actions distinctes, là où `onSignalAirClick` en confondait deux :
 * replier (sans effet), masquer les marqueurs (réversible, sans perte), et
 * désactiver (réinitialise la sélection). Sans cette séparation, chaque repli
 * accidentel jetait les signalements chargés.
 *
 * Le bouton de visibilité est la première ligne du CORPS et non l'en-tête : un
 * bouton imbriqué dans un bouton est du HTML invalide.
 */
export const SignalAirSourceDisclosure: React.FC<
  SignalAirSourceDisclosureProps
> = ({ community, onLoaded }) => {
  const { t } = useTranslation();

  const {
    isSignalAirEnabled,
    onSignalAirEnabledChange,
    isSignalAirVisible,
    onSignalAirToggle,
    hasSignalAirData,
    signalAirSelectedTypes,
    onSignalAirTypesChange,
    signalAirDraftPeriod,
    onSignalAirDraftPeriodChange,
    onSignalAirLoadRequest,
    isSignalAirLoading,
    signalAirHasLoaded,
    signalAirReportsCount,
  } = community;

  const label = getSourceDisplayName("signalair", t);
  const allTypesSelected =
    signalAirSelectedTypes.length === SIGNAL_TYPE_IDS.length;

  const handleTypeToggle = (id: string) => {
    onSignalAirTypesChange(
      signalAirSelectedTypes.includes(id)
        ? signalAirSelectedTypes.filter((type) => type !== id)
        : [...signalAirSelectedTypes, id]
    );
  };

  const handleLoad = () => {
    if (!isSignalAirEnabled) onSignalAirEnabledChange(true);
    onSignalAirLoadRequest();
    onLoaded();
  };

  return (
    <LayerDisclosure
      label={label}
      active={isSignalAirEnabled}
      activeLabel={t("controls.specialSourcesActive")}
      // Le nombre brut de signalements chargés, sans nouvelle clé : un
      // `n/total` n'aurait pas de total à énoncer ici.
      hint={
        signalAirHasLoaded && isSignalAirEnabled
          ? String(signalAirReportsCount)
          : undefined
      }
      // Le contenu du popover est démonté à la fermeture : ce `defaultOpen`
      // reproduit exactement l'effet d'auto-ouverture qu'il remplace, sans
      // aucune ref de garde — le démontage fait le travail des trois refs.
      defaultOpen={isSignalAirEnabled && !signalAirHasLoaded}
    >
      <div data-testid="sources-signalair-body" className="space-y-2 pl-4 pr-1 pt-1">
        {hasSignalAirData && (
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
        )}

        <div
          role="group"
          aria-label={t("panels.signalAirSelection.typesTitle", {
            selected: signalAirSelectedTypes.length,
            total: SIGNAL_TYPE_IDS.length,
          })}
        >
          <div className="mb-1 flex items-center justify-between px-2">
            <span className="text-xs text-[color:var(--fg-muted)]">
              {t("panels.signalAirSelection.typesTitle", {
                selected: signalAirSelectedTypes.length,
                total: SIGNAL_TYPE_IDS.length,
              })}
            </span>
            <button
              type="button"
              onClick={() =>
                onSignalAirTypesChange(
                  allTypesSelected ? [] : [...SIGNAL_TYPE_IDS]
                )
              }
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              {allTypesSelected
                ? t("panels.signalAirSelection.deselectAll")
                : t("panels.signalAirSelection.selectAll")}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {SIGNAL_TYPE_IDS.map((id) => {
              const checked = signalAirSelectedTypes.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  data-testid={`sources-signalair-type-${id}`}
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => handleTypeToggle(id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                    checked
                      ? "border-blue-300 bg-blue-50 text-[#1f3c6d]"
                      : "border-black/[0.09] bg-white text-gray-700 hover:bg-black/[0.04]"
                  )}
                >
                  <img
                    src={`/markers/signalAirMarkers/${
                      id === "bruit" ? "bruits" : id
                    }.png`}
                    alt=""
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 object-contain"
                  />
                  <span className="truncate">
                    {t(`panels.signalAirSelection.types.${id}.label`)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <SignalAirPeriodSelector
          startDate={signalAirDraftPeriod.startDate}
          endDate={signalAirDraftPeriod.endDate}
          onPeriodChange={onSignalAirDraftPeriodChange}
          layout="stacked"
        />

        <button
          type="button"
          data-testid="sources-signalair-load"
          onClick={handleLoad}
          disabled={signalAirSelectedTypes.length === 0 || isSignalAirLoading}
          className={cn(
            "w-full rounded-md px-3 py-2 text-xs font-medium transition-colors",
            signalAirSelectedTypes.length === 0 || isSignalAirLoading
              ? "cursor-not-allowed bg-black/[0.06] text-[color:var(--fg-muted)]"
              : "bg-blue-600 text-white hover:bg-blue-700"
          )}
        >
          {isSignalAirLoading
            ? t("panels.loadingInProgress")
            : t("panels.signalAirSelection.loadReports")}
        </button>
        {signalAirSelectedTypes.length === 0 && (
          <p className="px-2 text-xs text-red-600">
            {t("panels.signalAirSelection.selectAtLeastOne")}
          </p>
        )}

        {isSignalAirEnabled && (
          <button
            type="button"
            data-testid="sources-signalair-disable"
            onClick={() => onSignalAirEnabledChange(false)}
            className="w-full rounded-md px-2 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            {t("controls.disableSignalAir")}
          </button>
        )}
      </div>
    </LayerDisclosure>
  );
};

export default SignalAirSourceDisclosure;
