import React from "react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "../ui/dropdown-menu";
import { cn } from "../../lib/utils";

interface ExpertMenuProps {
  // Options de modélisation
  showModeling?: boolean;
  onModelingChange?: (checked: boolean) => void;
  loadingModeling?: boolean;
  modelingDisabled?: boolean;
  modelingDisabledReason?: string;

  // Options de données brutes
  showRawData?: boolean;
  onRawDataChange?: (checked: boolean) => void;
  rawDataAvailable?: boolean;

  // Option fond coloré par seuil (mode daltoniens)
  hideThresholdBackgroundForColorblind?: boolean;
  onHideThresholdBackgroundForColorblindChange?: (checked: boolean) => void;

  // Mode historique : seule l'option "données brutes" reste active
  historicalLocked?: boolean;
}

const ExpertMenu: React.FC<ExpertMenuProps> = ({
  showModeling = false,
  onModelingChange,
  loadingModeling = false,
  modelingDisabled = false,
  modelingDisabledReason,
  showRawData = false,
  onRawDataChange,
  rawDataAvailable = false,
  hideThresholdBackgroundForColorblind = false,
  onHideThresholdBackgroundForColorblindChange,
  historicalLocked = false,
}) => {
  const { t } = useTranslation();
  // Compter le nombre d'options actives pour l'indicateur
  const activeOptionsCount =
    (showModeling ? 1 : 0) +
    (showRawData ? 1 : 0) +
    (hideThresholdBackgroundForColorblind ? 1 : 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200",
            "bg-gradient-to-br from-gray-50 to-white border-gray-200/60 text-gray-800",
            "hover:from-gray-100 hover:to-gray-50 hover:border-gray-300 hover:shadow-sm",
            "focus:outline-none focus:ring-2 focus:ring-[#4271B3]/20 focus:border-[#4271B3]",
            "backdrop-blur-sm"
          )}
          aria-label={t("controls.advancedOptions")}
        >
          {/* Icône d'engrenage */}
          <svg
            className="h-4 w-4 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="hidden sm:inline">{t("controls.advancedOptions")}</span>
          <span className="sm:hidden">{t("controls.advancedOptionsShort")}</span>
          
          {/* Indicateur d'options actives */}
          {activeOptionsCount > 0 && (
            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-[#4271B3] text-xs font-semibold text-white">
              {activeOptionsCount}
            </span>
          )}
          
          {/* Flèche */}
          <svg
            className="h-4 w-4 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 sm:w-72"
        sideOffset={5}
      >
        <DropdownMenuLabel className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t("controls.advancedOptions")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Option Modélisation AZUR */}
        {onModelingChange && (
          <DropdownMenuCheckboxItem
            checked={showModeling}
            onCheckedChange={onModelingChange}
            disabled={modelingDisabled || loadingModeling || historicalLocked}
            className="px-3 py-2.5 cursor-pointer"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {loadingModeling && (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#4271B3]"></div>
                )}
                <span className="text-sm font-medium text-gray-900">
                  {t("controls.modelingAzur")}
                </span>
              </div>
              {modelingDisabledReason && (
                <span className="text-xs text-gray-500 ml-5">
                  {modelingDisabledReason}
                </span>
              )}
              <span className="text-xs text-gray-500 ml-5">
                {t("controls.modelingAzurDescription")}
              </span>
            </div>
          </DropdownMenuCheckboxItem>
        )}

        {/* Option Données brutes */}
        {onRawDataChange && rawDataAvailable && (
          <>
            {(onModelingChange && onRawDataChange) && <DropdownMenuSeparator />}
            <DropdownMenuCheckboxItem
              checked={showRawData}
              onCheckedChange={onRawDataChange}
              className="px-3 py-2.5 cursor-pointer"
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-900">
                  {t("controls.rawData")}
                </span>
                <span className="text-xs text-gray-500 ml-5">
                  {t("controls.rawDataDescription")}
                </span>
              </div>
            </DropdownMenuCheckboxItem>
          </>
        )}

        {/* Option Désactivé seuils (daltoniens) */}
        {onHideThresholdBackgroundForColorblindChange && (
          <>
            {(onModelingChange || (onRawDataChange && rawDataAvailable)) && (
              <DropdownMenuSeparator />
            )}
            <DropdownMenuCheckboxItem
              checked={hideThresholdBackgroundForColorblind}
              onCheckedChange={onHideThresholdBackgroundForColorblindChange}
              disabled={historicalLocked}
              className="px-3 py-2.5 cursor-pointer"
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-900">
                  {t("controls.thresholdBackgroundDisabled")}
                </span>
                <span className="text-xs text-gray-500 ml-5">
                  {t("controls.thresholdBackgroundDisabledDescription")}
                </span>
              </div>
            </DropdownMenuCheckboxItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExpertMenu;
