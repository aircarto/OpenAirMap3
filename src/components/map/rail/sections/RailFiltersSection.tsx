import React from "react";
import { useTranslation } from "react-i18next";
import PollutantDropdown from "../../../controls/PollutantDropdown";
import SourceDropdown from "../../../controls/SourceDropdown";
import TimeStepDropdown from "../../../controls/TimeStepDropdown";
import { useMapControls } from "../../../../contexts/mapControlsContext";
import RailItem from "../RailItem";
import RailSection from "../RailSection";
import {
  RAIL_FLYOUT_CLASS,
  RAIL_FLYOUT_SIDE_OFFSET,
  railFlyoutSide,
} from "../railFlyout";
import { IconPollutant, IconSources, IconTimeStep } from "../railIcons";
import type { RailOrientation } from "../useRailRoving";

export interface RailFiltersSectionProps {
  orientation: RailOrientation;
  onItemFocus: (event: React.FocusEvent<HTMLElement>) => void;
}

/**
 * Groupe « données » : polluant, sources, pas de temps.
 *
 * Les trois contrôles sont réutilisés tels quels — seul leur déclencheur change,
 * via `renderTrigger`. Le rendu des menus, la compatibilité source/pas de temps
 * et les toasts restent leur propriété.
 */
export const RailFiltersSection: React.FC<RailFiltersSectionProps> = ({
  orientation,
  onItemFocus,
}) => {
  const { filters, refresh, historical, ui } = useMapControls();
  const { t } = useTranslation();

  const side = railFlyoutSide(orientation);
  const flyout = {
    menuSide: side,
    menuAlign: "start" as const,
    menuSideOffset: RAIL_FLYOUT_SIDE_OFFSET,
    menuClassName: RAIL_FLYOUT_CLASS,
  };

  const sourcesCount = filters.selectedSources.length;

  return (
    <RailSection
      label={t("rail.groupData")}
      orientation={orientation}
      locked={ui.controlsLocked}
      lockedReason={t("rail.frozenDuringPlayback")}
    >
      {/* Polluant */}
      <label htmlFor="rail-pollutant-trigger" className="sr-only" id="rail-pollutant-label">
        {t("controls.pollutant")}
      </label>
      <PollutantDropdown
        selectedPollutant={filters.selectedPollutant}
        onPollutantChange={filters.onPollutantChange}
        selectedTimeStep={filters.selectedTimeStep}
        {...flyout}
        renderTrigger={({ displayText }) => (
          <RailItem
            itemId="pollutant"
            id="rail-pollutant-trigger"
            data-testid="rail-pollutant-trigger"
            data-tour="global-pollutant"
            aria-labelledby="rail-pollutant-label rail-pollutant-value"
            aria-haspopup="menu"
            onFocus={onItemFocus}
            label={t("controls.pollutant")}
            icon={<IconPollutant />}
            caption={<span id="rail-pollutant-value">{displayText}</span>}
          />
        )}
      />

      {/* Sources */}
      <label htmlFor="rail-sources-trigger" className="sr-only" id="rail-sources-label">
        {t("controls.sources")}
      </label>
      <SourceDropdown
        selectedSources={filters.selectedSources}
        selectedTimeStep={filters.selectedTimeStep}
        onSourceChange={filters.onSourceChange}
        onTimeStepChange={filters.onTimeStepChange}
        onToast={ui.onToast}
        autoRefreshEnabled={refresh.autoRefreshEnabled}
        onToggleAutoRefresh={refresh.onToggleAutoRefresh}
        loading={refresh.loading}
        isHistoricalModeActive={historical.isActive}
        {...flyout}
        renderTrigger={() => (
          <RailItem
            itemId="sources"
            id="rail-sources-trigger"
            data-testid="rail-sources-trigger"
            data-tour="global-sources"
            aria-labelledby="rail-sources-label rail-sources-value"
            aria-haspopup="menu"
            onFocus={onItemFocus}
            label={t("controls.sources")}
            icon={<IconSources />}
            // État vide aujourd'hui muet dans le header : zéro source est signalé
            warning={sourcesCount === 0}
            caption={
              <span id="rail-sources-value">
                {t("rail.caption.sources", { count: sourcesCount })}
              </span>
            }
          />
        )}
      />

      {/* Pas de temps */}
      <label htmlFor="rail-timestep-trigger" className="sr-only" id="rail-timestep-label">
        {t("controls.timeStep")}
      </label>
      <TimeStepDropdown
        selectedTimeStep={filters.selectedTimeStep}
        selectedSources={filters.selectedSources}
        onTimeStepChange={filters.onTimeStepChange}
        onSourceChange={filters.onSourceChange}
        onToast={ui.onToast}
        {...flyout}
        renderTrigger={({ displayText }) => (
          <RailItem
            itemId="timestep"
            id="rail-timestep-trigger"
            data-testid="rail-timestep-trigger"
            data-tour="global-timestep"
            aria-labelledby="rail-timestep-label rail-timestep-value"
            aria-haspopup="menu"
            onFocus={onItemFocus}
            label={t("controls.timeStep")}
            icon={<IconTimeStep />}
            caption={
              <span id="rail-timestep-value" className="rtl-on-ar">
                {displayText}
              </span>
            }
          />
        )}
      />
    </RailSection>
  );
};

export default RailFiltersSection;
