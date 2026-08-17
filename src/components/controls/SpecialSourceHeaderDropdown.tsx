import React from "react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { DropdownButton } from "./DropdownButton";
import type { CustomTriggerProps } from "./dropdownTriggerContract";
import { cn } from "../../lib/utils";

export interface SpecialSourceHeaderDropdownProps extends CustomTriggerProps {
  onSignalAirClick: () => void;
  onMobileAirClick: () => void;
  isSignalAirVisible: boolean;
  isMobileAirVisible: boolean;
  onSignalAirToggle: (visible: boolean) => void;
  onMobileAirToggle: (visible: boolean) => void;
  hasSignalAirData: boolean;
  hasMobileAirData: boolean;
  disabled?: boolean;
}

const SpecialSourceHeaderDropdown: React.FC<SpecialSourceHeaderDropdownProps> = ({
  onSignalAirClick,
  onMobileAirClick,
  isSignalAirVisible,
  isMobileAirVisible,
  onSignalAirToggle,
  onMobileAirToggle,
  hasSignalAirData,
  hasMobileAirData,
  disabled = false,
  renderTrigger,
  menuSide,
  menuAlign,
  menuSideOffset,
  menuClassName,
}) => {
  const { t } = useTranslation();
  const hasAny = hasSignalAirData || hasMobileAirData;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {renderTrigger ? (
          renderTrigger({
            displayText: t("controls.specialSources"),
            disabled,
          })
        ) : (
          <DropdownButton
            disabled={disabled}
            chevronClassName="justify-end pr-2 w-7"
            className={cn(
              "flex items-center gap-2 pr-8 min-w-[100px] max-w-[160px]",
              disabled && "opacity-60 pointer-events-none"
            )}
            aria-label={t("controls.specialSourcesAria")}
          >
            <span className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="truncate">{t("controls.specialSources")}</span>
              {hasAny && (
                <span
                  className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"
                  aria-hidden
                  title={t("controls.specialSourcesActive")}
                />
              )}
            </span>
          </DropdownButton>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={menuSide}
        align={menuAlign ?? "end"}
        sideOffset={menuSideOffset ?? 4}
        className={cn(
          "min-w-[220px] max-w-[min(220px,calc(100vw-1rem))] p-2",
          menuClassName
        )}
      >
        <DropdownMenuLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-1.5">
          {t("controls.specialSourcesMenuLabel")}
        </DropdownMenuLabel>

        {/* SignalAir */}
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg p-2 transition-colors",
            hasSignalAirData
              ? "bg-[#13A0DB]/5 border border-[#13A0DB]/20"
              : "bg-gray-50/80 border border-transparent"
          )}
        >
          <button
            type="button"
            onClick={() => {
              onSignalAirClick();
            }}
            className={cn(
              "flex items-center gap-2 flex-1 min-w-0 rounded-md py-1.5 px-2 text-left text-sm font-medium",
              "hover:bg-[#13A0DB]/10 focus:outline-none focus:ring-2 focus:ring-[#13A0DB]/30 focus:ring-offset-1"
            )}
          >
            <span className="truncate">SignalAir</span>
            {hasSignalAirData && (
              <span
                className={cn(
                  "shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded",
                  isSignalAirVisible
                    ? "bg-emerald-500/90 text-white"
                    : "bg-gray-200 text-gray-500"
                )}
                title={
                  isSignalAirVisible
                    ? t("controls.visibleOnMap")
                    : t("controls.hiddenOnMap")
                }
              >
                {isSignalAirVisible ? t("controls.active") : t("controls.inactive")}
              </span>
            )}
          </button>
          {hasSignalAirData && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSignalAirToggle(!isSignalAirVisible);
              }}
              className={cn(
                "shrink-0 w-8 h-7 rounded-md text-xs font-medium flex items-center justify-center transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-[#13A0DB]/30 focus:ring-offset-1",
                isSignalAirVisible
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
              )}
              aria-label={isSignalAirVisible ? t("panels.hideSignalAirAria") : t("panels.showSignalAirAria")}
              aria-pressed={isSignalAirVisible}
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {isSignalAirVisible ? (
                  <path d="M4.5 12.5l5 5 10-10" />
                ) : (
                  <path d="M6 6l12 12M18 6L6 18" />
                )}
              </svg>
            </button>
          )}
        </div>

        {/* MobileAir */}
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg p-2 mt-1.5 transition-colors",
            hasMobileAirData
              ? "bg-green-500/5 border border-green-500/20"
              : "bg-gray-50/80 border border-transparent"
          )}
        >
          <button
            type="button"
            onClick={() => onMobileAirClick()}
            className={cn(
              "flex items-center gap-2 flex-1 min-w-0 rounded-md py-1.5 px-2 text-left text-sm font-medium",
              "hover:bg-green-500/10 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:ring-offset-1"
            )}
          >
            <span className="truncate">MobileAir</span>
            {hasMobileAirData && (
              <span
                className={cn(
                  "shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded",
                  isMobileAirVisible
                    ? "bg-emerald-500/90 text-white"
                    : "bg-gray-200 text-gray-500"
                )}
                title={
                  isMobileAirVisible
                    ? t("controls.visibleOnMap")
                    : t("controls.hiddenOnMap")
                }
              >
                {isMobileAirVisible ? t("controls.active") : t("controls.inactive")}
              </span>
            )}
          </button>
          {hasMobileAirData && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMobileAirToggle(!isMobileAirVisible);
              }}
              className={cn(
                "shrink-0 w-8 h-7 rounded-md text-xs font-medium flex items-center justify-center transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:ring-offset-1",
                isMobileAirVisible
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
              )}
              aria-label={isMobileAirVisible ? t("panels.hideMobileAirAria") : t("panels.showMobileAirAria")}
              aria-pressed={isMobileAirVisible}
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {isMobileAirVisible ? (
                  <path d="M4.5 12.5l5 5 10-10" />
                ) : (
                  <path d="M6 6l12 12M18 6L6 18" />
                )}
              </svg>
            </button>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SpecialSourceHeaderDropdown;
