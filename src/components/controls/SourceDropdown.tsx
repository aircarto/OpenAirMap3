import React, { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { COMMUNAUTAIRE_SOURCE_CODES } from "../../constants/sources";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Checkbox } from "../ui/checkbox";
import { DropdownButton } from "./DropdownButton";
import SourceGroupCheckbox from "./SourceGroupCheckbox";
import type { CustomTriggerProps } from "./dropdownTriggerContract";
import { cn } from "../../lib/utils";
import {
  isSourceCompatibleWithTimeStep,
  getSourceDisplayName,
  getSupportedTimeStepsForSource,
  getFirstCompatibleTimeStep,
} from "../../utils/sourceCompatibility";
import { Toast } from "../ui/toast";
import AutoRefreshToggle from "./AutoRefreshToggle";

const MAIN_SOURCE_CODES = ["atmoRef", "atmoMicro"] as const;

interface SourceDropdownProps extends CustomTriggerProps {
  selectedSources: string[];
  selectedTimeStep?: string;
  onSourceChange: (sources: string[]) => void;
  onTimeStepChange?: (timeStep: string) => void;
  onToast?: (toast: Omit<Toast, "id">) => void;
  /** Actualisation auto : affiche le toggle en tête du menu (au-dessus des sources) */
  autoRefreshEnabled?: boolean;
  onToggleAutoRefresh?: (enabled: boolean) => void;
  loading?: boolean;
  isHistoricalModeActive?: boolean;
  /** Id du trigger pour association avec un <label htmlFor> (accessibilité) */
  triggerId?: string;
}

/**
 * Ligne de source cochable.
 *
 * Un `Checkbox` et une étiquette liée par `htmlFor`, et non un
 * `DropdownMenuCheckboxItem` : celui-ci **ferme le menu à chaque cochage**.
 * Vérifié dans `@radix-ui/react-menu` — `MenuItem.handleSelect` appelle
 * `rootContext.onClose()` dès que l'événement de sélection n'est pas prévenu, et
 * `MenuCheckboxItem` compose son `onSelect` sans le prévenir. Sur un menu à choix
 * multiple, cocher deux sources demandait donc deux réouvertures ; et lorsque la
 * source était incompatible avec le pas de temps courant, le clic fermait le
 * menu, affichait un toast et ne changeait rien.
 */
const SourceCheckboxRow: React.FC<{
  code: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
  indented?: boolean;
}> = ({ code, label, checked, onToggle, indented = false }) => {
  const id = useId();

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-2 py-2 transition-colors",
        indented && "ml-4",
        checked ? "bg-[#e7eef8]" : "hover:bg-black/[0.04]"
      )}
    >
      <Checkbox
        id={id}
        data-testid={`source-${code}`}
        checked={checked}
        onCheckedChange={onToggle}
      />
      <label
        htmlFor={id}
        className={cn(
          "flex-1 cursor-pointer text-sm",
          checked ? "text-[#1f3c6d]" : "text-gray-700"
        )}
      >
        {label}
      </label>
    </div>
  );
};

const SourceDropdown: React.FC<SourceDropdownProps> = ({
  selectedSources,
  selectedTimeStep,
  onSourceChange,
  onTimeStepChange,
  onToast,
  autoRefreshEnabled = false,
  onToggleAutoRefresh,
  loading = false,
  isHistoricalModeActive = false,
  triggerId,
  renderTrigger,
  menuSide,
  menuAlign,
  menuSideOffset,
  menuClassName,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const mainLabelId = useId();

  const communautaireSubSources = useMemo(
    () =>
      COMMUNAUTAIRE_SOURCE_CODES.map((code) => ({
        code,
        label: getSourceDisplayName(code, t),
      })),
    [t]
  );

  const communautaireSelectedCount = useMemo(
    () =>
      COMMUNAUTAIRE_SOURCE_CODES.filter((source) =>
        selectedSources.includes(source)
      ).length,
    [selectedSources]
  );
  const allCommunautaireSelected =
    communautaireSelectedCount === COMMUNAUTAIRE_SOURCE_CODES.length;

  const handleSourceToggle = (sourceCode: string) => {
    const isCurrentlySelected = selectedSources.includes(sourceCode);

    // Si on essaie d'activer une source
    if (!isCurrentlySelected) {
      // Vérifier la compatibilité si le pas de temps est fourni
      if (selectedTimeStep && onToast) {
        const isCompatible = isSourceCompatibleWithTimeStep(
          sourceCode,
          selectedTimeStep
        );

        if (!isCompatible) {
          // Afficher une notification toast
          const supportedStepCodes = getSupportedTimeStepsForSource(sourceCode);
          const supportedStepsLabel = supportedStepCodes
            .map((step) => t(`timeSteps.${step}`))
            .join(", ");
          const firstCompatibleStep = getFirstCompatibleTimeStep(sourceCode);
          const sourceName = getSourceDisplayName(sourceCode, t);

          onToast({
            title: t("toast.sourceUnavailable", { name: sourceName }),
            description: t("toast.sourceAvailableOnlyFor", {
              steps: supportedStepsLabel,
            }),
            variant: "warning",
            action:
              firstCompatibleStep && onTimeStepChange
                ? {
                    label: t("toast.changeTo", {
                      step: t(`timeSteps.${firstCompatibleStep}`),
                    }),
                    onClick: () => onTimeStepChange(firstCompatibleStep),
                  }
                : undefined,
          });

          // Ne pas activer la source si elle n'est pas compatible
          return;
        }
      }
    }

    // Comportement normal : activer/désactiver
    const newSources = isCurrentlySelected
      ? selectedSources.filter((s) => s !== sourceCode)
      : [...selectedSources, sourceCode];
    onSourceChange(newSources);
  };

  /**
   * Tout cocher / tout décocher le groupe communautaire.
   *
   * Sémantique inchangée, y compris le fait que ce chemin **contourne** la garde
   * de compatibilité pas de temps appliquée aux cases individuelles : cocher le
   * groupe peut donc sélectionner une source que le pas de temps courant ne sait
   * pas servir. C'est une incohérence préexistante, laissée telle quelle ici
   * pour ne pas mêler un changement de comportement à un portage de primitive.
   */
  const handleCommunautaireGroupToggle = () => {
    if (allCommunautaireSelected) {
      onSourceChange(
        selectedSources.filter(
          (source) => !COMMUNAUTAIRE_SOURCE_CODES.includes(source)
        )
      );
      return;
    }

    const newSources = [...selectedSources];
    COMMUNAUTAIRE_SOURCE_CODES.forEach((source) => {
      if (!newSources.includes(source)) newSources.push(source);
    });
    onSourceChange(newSources);
  };

  const getDisplayText = () => {
    if (selectedSources.length === 0) {
      return t("controls.chooseSources");
    }
    if (selectedSources.length === 1) {
      return getSourceDisplayName(selectedSources[0], t);
    }
    return t("controls.sourcesSelected", { count: selectedSources.length });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {renderTrigger ? (
          renderTrigger({ displayText: getDisplayText() })
        ) : (
          <DropdownButton
            id={triggerId}
            data-tour="global-sources"
            className="min-w-[88px] max-w-[200px]"
          >
            <span className="block truncate pr-6">{getDisplayText()}</span>
          </DropdownButton>
        )}
      </PopoverTrigger>
      <PopoverContent
        side={menuSide}
        align={menuAlign ?? "start"}
        sideOffset={menuSideOffset}
        aria-label={t("controls.sources")}
        data-testid="sources-flyout"
        className={cn(
          "flex flex-col",
          // Hauteur bornée sur la place réellement disponible, et défilement
          // délégué à la région interne : la racine doit rester non défilante
          // pour qu'un futur en-tête collant tienne.
          "max-h-[min(72vh,var(--radix-popover-content-available-height))]",
          !renderTrigger && "w-[var(--radix-popover-trigger-width)]",
          menuClassName
        )}
      >
        {/* Actualisation auto — en tête mais visuellement discrète */}
        {typeof onToggleAutoRefresh === "function" && (
          <div className="shrink-0 border-b border-black/[0.06] px-3 pt-2 pb-1.5">
            <AutoRefreshToggle
              enabled={autoRefreshEnabled}
              onToggle={onToggleAutoRefresh}
              loading={loading}
              disabled={isHistoricalModeActive}
              compact
            />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {/* Sources principales */}
          <div role="group" aria-labelledby={mainLabelId}>
            <div
              id={mainLabelId}
              className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-gray-500"
            >
              {t("controls.mainSources")}
            </div>
            {MAIN_SOURCE_CODES.map((code) => (
              <SourceCheckboxRow
                key={code}
                code={code}
                label={getSourceDisplayName(code, t)}
                checked={selectedSources.includes(code)}
                onToggle={() => handleSourceToggle(code)}
              />
            ))}
          </div>

          <div
            role="separator"
            className="my-1.5 border-t border-black/[0.06]"
          />

          {/* Groupe communautaire */}
          <div role="group" aria-label={t("controls.sourceCommunautaire")}>
            <SourceGroupCheckbox
              testId="sources-group-communautaire-all"
              label={t("controls.sourceCommunautaire")}
              scope={COMMUNAUTAIRE_SOURCE_CODES}
              selectedSources={selectedSources}
              onToggle={handleCommunautaireGroupToggle}
              hint={t("controls.sourceGroupCount", {
                selected: communautaireSelectedCount,
                total: COMMUNAUTAIRE_SOURCE_CODES.length,
              })}
            />
            {communautaireSubSources.map(({ code, label }) => (
              <SourceCheckboxRow
                key={code}
                code={code}
                label={label}
                checked={selectedSources.includes(code)}
                onToggle={() => handleSourceToggle(code)}
                indented
              />
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SourceDropdown;
