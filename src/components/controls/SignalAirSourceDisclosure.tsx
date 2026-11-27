import React from "react";
import { useTranslation } from "react-i18next";
import SourceGroupCheckbox from "./SourceGroupCheckbox";
import SourceCheckboxRow from "./SourceCheckboxRow";
import { getSourceDisplayName } from "../../utils/sourceCompatibility";
import { isMapInstantAllowedForTimeStep } from "../../utils/mapInstant";
import type { MapControlsCommunitySources } from "../../contexts/mapControlsContext";

const SIGNAL_TYPE_IDS = ["odeur", "bruit", "brulage", "visuel"] as const;

export interface SignalAirSourceDisclosureProps {
  community: MapControlsCommunitySources;
  selectedTimeStep: string;
  /** Conservé pour l’API du slot Sources ; plus de fermeture forcée au chargement */
  onLoaded?: () => void;
}

/**
 * Groupe SignalAir du menu Sources, sur le modèle « Autres capteurs
 * communautaires » : une case parente à trois états, puis une ligne par type.
 *
 * - Case parente : éteinte → allume avec tous les types ; allumée (partielle
 *   ou complète) → éteint.
 * - Type coché alors que la source est éteinte → allume avec ce seul type.
 * - Décocher le dernier type éteint la source (côté App, liste vide).
 * - Hors 15 min / heure / jour : désactivé.
 * - En mode mobilité MobileAir : grisé, clic = sortie du mode + réactivation.
 *
 * Plus de bouton « masquer » : décocher suffit, comme pour les autres sources.
 */
export const SignalAirSourceDisclosure: React.FC<
  SignalAirSourceDisclosureProps
> = ({ community, selectedTimeStep }) => {
  const { t } = useTranslation();

  const {
    isSignalAirEnabled,
    onSignalAirEnabledChange,
    signalAirSelectedTypes,
    onSignalAirTypesChange,
    isSignalAirLoading,
    signalAirHasLoaded,
    signalAirReportsCount,
    isMobileAirMobilityMode,
    onExitMobilityModeViaSignalAir,
  } = community;

  const compatible = isMapInstantAllowedForTimeStep(selectedTimeStep);
  const muted = isMobileAirMobilityMode;
  const disabled = !compatible && !muted;
  const active = isSignalAirEnabled && !muted;

  const selectedCount = active
    ? SIGNAL_TYPE_IDS.filter((id) => signalAirSelectedTypes.includes(id))
        .length
    : 0;

  const groupChecked: boolean | "indeterminate" =
    selectedCount === 0
      ? false
      : selectedCount === SIGNAL_TYPE_IDS.length
        ? true
        : "indeterminate";

  const countHint = t("controls.sourceGroupCount", {
    selected: selectedCount,
    total: SIGNAL_TYPE_IDS.length,
  });
  const hint =
    active && signalAirHasLoaded
      ? `${countHint} · ${signalAirReportsCount}`
      : countHint;

  const handleGroupToggle = () => {
    if (muted) {
      onExitMobilityModeViaSignalAir();
      return;
    }
    if (!compatible) return;
    if (isSignalAirEnabled) {
      onSignalAirEnabledChange(false);
      return;
    }
    onSignalAirEnabledChange(true, [...SIGNAL_TYPE_IDS]);
  };

  const handleTypeToggle = (id: string) => {
    if (muted) {
      onExitMobilityModeViaSignalAir();
      return;
    }
    if (!compatible) return;
    if (!isSignalAirEnabled) {
      onSignalAirEnabledChange(true, [id]);
      return;
    }
    const next = signalAirSelectedTypes.includes(id)
      ? signalAirSelectedTypes.filter((type) => type !== id)
      : [...signalAirSelectedTypes, id];
    onSignalAirTypesChange(next);
  };

  return (
    <div data-testid="sources-signalair-body">
      {muted ? (
        <p
          data-testid="sources-signalair-mobility-hint"
          className="px-2 pb-1 text-xs text-[color:var(--fg-muted)]"
        >
          {t("controls.mobilityModeHint")}
        </p>
      ) : null}

      <SourceGroupCheckbox
        testId="sources-signalair-enable"
        label={getSourceDisplayName("signalair", t)}
        checked={groupChecked}
        onToggle={handleGroupToggle}
        muted={muted}
        disabled={disabled}
        hint={hint}
      />

      {SIGNAL_TYPE_IDS.map((id) => (
        <SourceCheckboxRow
          key={id}
          code={id}
          testId={`sources-signalair-type-${id}`}
          label={t(`panels.signalAirSelection.types.${id}.label`)}
          checked={active && signalAirSelectedTypes.includes(id)}
          onToggle={() => handleTypeToggle(id)}
          indented
          muted={muted}
          disabled={disabled}
          icon={
            <img
              src={`/markers/signalAirMarkers/${
                id === "bruit" ? "bruits" : id
              }.png`}
              alt=""
              aria-hidden="true"
              className="h-4 w-4 shrink-0 object-contain"
            />
          }
        />
      ))}

      {disabled ? (
        <p
          data-testid="sources-signalair-incompatible"
          className="px-2 pt-1 text-xs text-[color:var(--fg-muted)]"
        >
          {t("panels.signalAirSelection.incompatibleTimeStep")}
        </p>
      ) : null}

      {isSignalAirLoading ? (
        <p className="px-2 pt-1 text-xs text-[color:var(--fg-muted)]">
          {t("panels.loadingInProgress")}
        </p>
      ) : null}
    </div>
  );
};

export default SignalAirSourceDisclosure;
