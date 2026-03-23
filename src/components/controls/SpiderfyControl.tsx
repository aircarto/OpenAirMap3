import React, { useState, useRef, useEffect } from "react";
import { SpiderfyConfig } from "../../types";

interface SpiderfyControlProps {
  config: SpiderfyConfig;
  onConfigChange: (config: SpiderfyConfig) => void;
}

const SpiderfyControl: React.FC<SpiderfyControlProps> = ({
  config,
  onConfigChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleEnabled = () => {
    onConfigChange({
      ...config,
      enabled: !config.enabled,
    });
  };

  const handleToggleAutoSpiderfy = () => {
    onConfigChange({
      ...config,
      autoSpiderfy: !config.autoSpiderfy,
    });
  };

  const handleZoomThresholdChange = (threshold: number) => {
    onConfigChange({
      ...config,
      autoSpiderfyZoomThreshold: threshold,
    });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-md p-2 text-center shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 hover:border-gray-300/70 transition-colors"
        title="Paramètres du spiderfier"
      >
        <div className="flex items-center justify-center">
          <svg
            className="w-4 h-4 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-[2000] w-64 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-md shadow-sm bottom-full mb-1 left-0">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Paramètres du spiderfier
            </h3>

            {/* Activation du spiderfier */}
            <div className="mb-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={handleToggleEnabled}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  Activer le spiderfier
                </span>
              </label>
            </div>

            {/* Activation automatique du spiderfier */}
            {config.enabled && (
              <div className="mb-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.autoSpiderfy}
                    onChange={handleToggleAutoSpiderfy}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    Spiderfier automatique au zoom
                  </span>
                </label>
              </div>
            )}

            {/* Seuil de zoom pour le spiderfier automatique */}
            {config.enabled && config.autoSpiderfy && (
              <div className="mb-3">
                <label htmlFor="spiderfy-zoom-threshold" className="block text-sm text-gray-700 mb-2">
                  Seuil de zoom pour le spiderfier
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    id="spiderfy-zoom-threshold"
                    type="range"
                    min="8"
                    max="18"
                    value={config.autoSpiderfyZoomThreshold}
                    onChange={(e) =>
                      handleZoomThresholdChange(Number(e.target.value))
                    }
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-sm text-gray-600 w-8">
                    {config.autoSpiderfyZoomThreshold}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Le spiderfier s'activera automatiquement au zoom{" "}
                  {config.autoSpiderfyZoomThreshold} et plus
                </p>
              </div>
            )}

            {/* Description */}
            <p className="text-xs text-gray-500 mt-3">
              Le spiderfier éclate automatiquement les marqueurs qui se
              chevauchent pour améliorer la lisibilité. Fonctionne
              indépendamment du clustering et s'active dès qu'il y a des
              marqueurs proches.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpiderfyControl;
