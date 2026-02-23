import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface ExportMenuProps {
  hasData: boolean;
  onExportPNG: () => Promise<void> | void;
  onExportCSV: () => void;
}

const ExportMenu: React.FC<ExportMenuProps> = React.memo(
  ({ hasData, onExportPNG, onExportCSV }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!isOpen) {
        return;
      }

      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen]);

    return (
      <div className="absolute top-2 right-2 z-10" ref={menuRef}>
        <button
          onClick={() => setIsOpen((open) => !open)}
          className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-100 transition-colors border border-gray-200"
          title={t("panels.chartExportMenuTitle")}
        >
          <svg
            className="w-5 h-5 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <div
          className={`absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20 ${
            isOpen ? "block" : "hidden"
          }`}
        >
          <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-b border-gray-200">
            {t("panels.exportChart")}
          </div>
          <button
            onClick={async () => {
              if (isExporting || !hasData) {
                return;
              }
              setIsExporting(true);
              try {
                await Promise.resolve(onExportPNG());
              } finally {
                setIsExporting(false);
                setIsOpen(false);
              }
            }}
            disabled={isExporting || !hasData}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>{t("panels.exporting")}</span>
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span>{t("panels.exportPNG")}</span>
              </>
            )}
          </button>
          <button
            onClick={() => {
              onExportCSV();
              setIsOpen(false);
            }}
            disabled={!hasData}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span>{t("panels.exportCSV")}</span>
          </button>
        </div>
      </div>
    );
  }
);

ExportMenu.displayName = "ExportMenu";

export default ExportMenu;

