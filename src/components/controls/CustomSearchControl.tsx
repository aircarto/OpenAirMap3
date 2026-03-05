import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import L from "leaflet";
import { MeasurementDevice } from "../../types";
import { getMarkerPath } from "../../utils";

// Déclaration de type pour l'extension Geoportal
declare module "leaflet" {
  namespace L {
    namespace geoportalControl {
      function SearchEngine(options?: any): any;
    }
  }
}

interface SearchResult {
  type: "sensor" | "address";
  device?: MeasurementDevice;
  address?: {
    name: string;
    lat: number;
    lng: number;
    type?: string;
    address?: string;
  };
}

interface CustomSearchControlProps {
  devices: MeasurementDevice[];
  mapRef: React.RefObject<L.Map | null>;
  onSensorSelected: (device: MeasurementDevice) => void;
  /** Appelé quand une localisation (adresse ou capteur) est validée, pour afficher un pinpoint sur la carte */
  onSearchLocationValidated?: (lat: number, lng: number) => void;
}

// Tableau de correspondance source -> libellé lisible
const SOURCE_LABELS: Record<string, string> = {
  atmoRef: "Station de référence AtmoSud",
  atmoMicro: "Microcapteur qualifié AtmoSud",
  nebuleair: "AirCarto",
  sensorCommunity: "Sensor.Community",
  purpleair: "PurpleAir",
  mobileair: "MobileAir",
  signalair: "SignalAir",
};

// Fonction pour obtenir le libellé d'une source
const getSourceLabel = (source: string): string => {
  return SOURCE_LABELS[source] || source;
};

const CustomSearchControl: React.FC<CustomSearchControlProps> = ({
  devices,
  mapRef,
  onSensorSelected,
  onSearchLocationValidated,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fonction pour rechercher dans les capteurs
  const searchSensors = useCallback(
    (query: string): SearchResult[] => {
      if (!query || query.length < 2) {
        return [];
      }

      const lowerQuery = query.toLowerCase();
      const matchingDevices = devices
        .filter((device) => {
          const nameMatch = device.name?.toLowerCase().includes(lowerQuery);
          return nameMatch;
        })
        .slice(0, 5); // Limiter à 5 capteurs

      return matchingDevices.map((device) => ({
        type: "sensor" as const,
        device,
      }));
    },
    [devices]
  );

  // Fonction pour rechercher des adresses via BAN (Base Adresse Nationale)
  const searchAddresses = useCallback(
    async (query: string): Promise<SearchResult[]> => {
      if (!query || query.length < 2) {
        return [];
      }

      try {
        // Utiliser l'API BAN (Base Adresse Nationale) - gratuite et sans clé API
        const searchUrl = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(
          query
        )}&limit=5`;

        const response = await fetch(searchUrl);
        if (!response.ok) {
          return [];
        }

        const data = await response.json();
        const addressResults: SearchResult[] = [];

        if (data.features && Array.isArray(data.features)) {
          for (const feature of data.features.slice(0, 5)) {
            if (feature.geometry && feature.geometry.coordinates) {
              const [lng, lat] = feature.geometry.coordinates;
              const properties = feature.properties || {};
              const label = properties.label || properties.name || "";
              
              addressResults.push({
                type: "address" as const,
                address: {
                  name: label,
                  lat,
                  lng,
                  type: properties.type || "address",
                  address: label,
                },
              });
            }
          }
        }

        return addressResults;
      } catch (error) {
        console.warn("Erreur lors de la recherche d'adresses:", error);
        return [];
      }
    },
    []
  );

  // Fonction de recherche combinée
  const performSearch = useCallback(
    async (query: string) => {
      if (!query || query.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsSearching(true);

      // Rechercher les capteurs (synchrone)
      const sensorResults = searchSensors(query);

      // Rechercher les adresses (asynchrone)
      const addressResults = await searchAddresses(query);

      // Combiner les résultats : d'abord les capteurs, puis les adresses
      const combinedResults = [...sensorResults, ...addressResults].slice(0, 10);

      setResults(combinedResults);
      setIsOpen(combinedResults.length > 0);
      setSelectedIndex(-1);
      setIsSearching(false);
    },
    [searchSensors, searchAddresses]
  );

  // Debounce de la recherche
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, 300); // Attendre 300ms après la dernière frappe

    return () => clearTimeout(timeoutId);
  }, [searchQuery, performSearch]);

  // Gérer le clic en dehors pour fermer la liste et éventuellement la barre de recherche
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      if (
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
        // Sur mobile, fermer aussi la barre de recherche si elle est ouverte
        if (window.innerWidth < 768 && isExpanded) {
          setIsExpanded(false);
          setSearchQuery("");
        }
      }
    };

    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isExpanded]);

  // Navigation au clavier
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      if (e.key === "Enter") {
        // Si pas de résultats, essayer une recherche directe IGN
        if (searchQuery.length >= 2 && mapRef.current) {
          handleAddressSearch(searchQuery);
        }
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleResultSelect(results[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        setSearchQuery("");
        break;
    }
  };

  // Gérer la sélection d'un résultat
  const handleResultSelect = (result: SearchResult) => {
    if (result.type === "sensor" && result.device) {
      // Centrer la carte sur le capteur
      if (mapRef.current) {
        mapRef.current.setView(
          [result.device.latitude, result.device.longitude],
          16,
          {
            animate: true,
            duration: 1.5,
          }
        );
      }
      // Afficher le pinpoint à l'emplacement du capteur
      onSearchLocationValidated?.(result.device.latitude, result.device.longitude);

      // Sélectionner le capteur et ouvrir le sidepanel
      onSensorSelected(result.device);
    } else if (result.type === "address" && result.address) {
      // Centrer la carte sur l'adresse
      if (mapRef.current) {
        const zoomLevel = getOptimalZoomLevel(result.address);
        mapRef.current.setView(
          [result.address.lat, result.address.lng],
          zoomLevel,
          {
            animate: true,
            duration: 1.5,
          }
        );
      }
      // Afficher le pinpoint à l'adresse sélectionnée
      onSearchLocationValidated?.(result.address.lat, result.address.lng);
    }

    // Fermer la liste et réinitialiser
    setIsOpen(false);
    setSelectedIndex(-1);
    setSearchQuery("");
    // Ne pas fermer complètement la barre de recherche, juste l'input
    inputRef.current?.blur();
  };

  // Fonction pour rechercher directement une adresse via BAN (fallback)
  const handleAddressSearch = async (query: string) => {
    if (!mapRef.current) {
      return;
    }

    try {
      // Utiliser l'API BAN directement
      const searchUrl = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(
        query
      )}&limit=1`;

      const response = await fetch(searchUrl);
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        if (feature.geometry && feature.geometry.coordinates) {
          const [lng, lat] = feature.geometry.coordinates;
          const properties = feature.properties || {};
          const zoomLevel = getOptimalZoomLevel({
            name: properties.label || "",
            type: properties.type,
            address: properties.label || "",
          });

          mapRef.current.setView([lat, lng], zoomLevel, {
            animate: true,
            duration: 1.5,
          });
          // Afficher le pinpoint à l'adresse trouvée (recherche directe IGN sans résultat dans la liste)
          onSearchLocationValidated?.(lat, lng);
        }
      }
    } catch (error) {
      console.warn("Erreur lors de la recherche d'adresse:", error);
    }
  };

  // Fonction utilitaire pour déterminer le niveau de zoom optimal
  const getOptimalZoomLevel = (result: {
    name?: string;
    type?: string;
    address?: string;
  }): number => {
    const address = result.address || "";
    const name = result.name || "";
    const type = result.type || "";

    switch (type.toLowerCase()) {
      case "house":
      case "building":
      case "address":
        return 18;
      case "street":
      case "road":
        return 16;
      case "neighbourhood":
      case "suburb":
      case "district":
        return 14;
      case "city":
      case "town":
      case "village":
        return 12;
      case "county":
      case "state":
      case "department":
        return 10;
      case "country":
      case "region":
        return 6;
      default:
        if (address.match(/\d+/) || name.match(/\d+/)) {
          return 18;
        } else if (
          address.includes("rue") ||
          address.includes("avenue") ||
          address.includes("boulevard") ||
          address.includes("place") ||
          name.includes("rue") ||
          name.includes("avenue") ||
          name.includes("boulevard") ||
          name.includes("place")
        ) {
          return 16;
        } else if (
          address.includes("arrondissement") ||
          address.includes("quartier") ||
          name.includes("arrondissement") ||
          name.includes("quartier")
        ) {
          return 14;
        } else if (address.includes("commune") || name.includes("commune")) {
          return 12;
        } else {
          return 15;
        }
    }
  };

  // Formater la valeur d'un capteur pour l'affichage
  const formatDeviceValue = (device: MeasurementDevice): string => {
    if (device.status === "active" && device.value >= 0) {
      return `${Math.round(device.value)} ${device.unit}`;
    }
    return t("search.noData");
  };

  // Composant pour afficher le marqueur avec la valeur
  const MarkerWithValue: React.FC<{ device: MeasurementDevice }> = ({
    device,
  }) => {
    const qualityLevel = device.qualityLevel || "default";
    const markerPath = getMarkerPath(device.source, qualityLevel);

    // Calculer la valeur à afficher
    let displayValue: string | null = null;
    let fontSize = "18px";
    let textColor = "#000000";
    let textShadow = "";

    if (device.status === "active" && device.value >= 0) {
      const roundedValue = Math.round(device.value);
      displayValue = roundedValue.toString();

      // Ajuster la taille du texte selon la longueur de la valeur
      if (roundedValue >= 1000) {
        fontSize = "10px";
      } else if (roundedValue >= 100) {
        fontSize = "12px";
      } else if (roundedValue >= 10) {
        fontSize = "16px";
      } else {
        fontSize = "18px";
      }

      // Couleur du texte selon le niveau de qualité
      const textColors: Record<string, string> = {
        bon: "#000000",
        moyen: "#000000",
        degrade: "#000000",
        mauvais: "#000000",
        tresMauvais: "#F2F2F2",
        extrMauvais: "#F2F2F2",
        default: "#666666",
      };

      textColor = textColors[qualityLevel] || "#000000";

      // Ajouter un contour pour améliorer la lisibilité
      if (qualityLevel === "extrMauvais" || qualityLevel === "tresMauvais") {
        textShadow =
          "1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)";
      }
    }

    return (
      <div
        className={`relative inline-block custom-marker-container ${device.source}`}
        style={{ width: "32px", height: "32px" }}
      >
        {/* Image du marqueur */}
        <img
          src={markerPath}
          alt={`${device.source} marker`}
          className="w-8 h-8"
          style={{ objectFit: "contain" }}
        />
        {/* Texte de la valeur superposé */}
        {displayValue && (
          <div
            className="value-text"
            style={{
              fontSize,
              color: textColor,
              textShadow,
            }}
          >
            {displayValue}
          </div>
        )}
        {/* Indicateur de valeur corrigée pour AtmoMicro */}
        {device.source === "atmoMicro" && device.has_correction && (
          <div
            className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center shadow-md"
            style={{ zIndex: 10 }}
          >
            <svg
              width="14"
              height="14"
              fill="white"
              viewBox="0 0 16 16"
              className="w-3.5 h-3.5"
            >
              <path d="M5.338 1.59a61.44 61.44 0 0 0-2.837.856.481.481 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.725 10.725 0 0 0 2.287 2.233c.346.244.652.42.893.533.12.057.218.095.293.118a.55.55 0 0 0 .101.025.615.615 0 0 0 .1-.025c.076-.023.174-.061.294-.118.24-.113.547-.29.893-.533a10.726 10.726 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.775 11.775 0 0 1-2.517 2.453 7.159 7.159 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7.158 7.158 0 0 1-1.048-.625 11.777 11.777 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 62.456 62.456 0 0 1 5.072.56z" />
              <path d="M10.854 5.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 7.793l2.646-2.647a.5.5 0 0 1 .708 0z" />
            </svg>
          </div>
        )}
      </div>
    );
  };

  // Gérer l'expansion/réduction
  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      // Quand on ouvre, focus sur l'input après un court délai pour l'animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      // Quand on ferme, réinitialiser
      setIsOpen(false);
      setSearchQuery("");
      inputRef.current?.blur();
    }
  };

  return (
    <div className="absolute top-4 right-4 z-[800]" ref={containerRef}>
      <div className="relative">
        {/* Mode compact : juste la loupe */}
        {!isExpanded && (
          <button
            onClick={handleToggleExpand}
            className="w-10 h-10 bg-white border border-gray-300 rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={t("search.openSearch")}
          >
            <svg
              className="h-5 w-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
        )}

        {/* Mode étendu : barre de recherche complète */}
        {isExpanded && (
          <div className="relative w-[calc(100vw-2rem)] sm:w-80 transition-all duration-300">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (results.length > 0) {
                    setIsOpen(true);
                  }
                }}
                placeholder={t("search.placeholder")}
                className="w-full px-4 py-2 pr-20 border border-gray-300 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
              />
              <div className="absolute right-10 top-1/2 -translate-y-1/2">
                {isSearching ? (
                  <svg
                    className="animate-spin h-5 w-5 text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                )}
              </div>
              {/* Bouton pour fermer */}
              <button
                onClick={handleToggleExpand}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                aria-label={t("search.closeSearch")}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Liste des résultats */}
        {isExpanded && isOpen && results.length > 0 && (
          <div
            ref={resultsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-96 overflow-y-auto z-[801]"
          >
            {results.map((result, index) => (
              <div
                key={index}
                onClick={() => handleResultSelect(result)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`px-4 py-3 cursor-pointer transition-colors ${
                  selectedIndex === index
                    ? "bg-blue-50 border-l-4 border-blue-500"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start space-x-3">
                  {/* Icône/Marqueur */}
                  <div className="flex-shrink-0 mt-0.5">
                    {result.type === "sensor" && result.device ? (
                      <MarkerWithValue device={result.device} />
                    ) : (
                      <span className="text-xl" role="img" aria-label="Adresse">
                        📍
                      </span>
                    )}
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    {result.type === "sensor" && result.device ? (
                      <>
                        <div className="font-medium text-gray-900 truncate">
                          {result.device.name}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          <span className="font-medium">
                            {getSourceLabel(result.device.source)}
                          </span>
                        </div>
                        
                      </>
                    ) : result.type === "address" && result.address ? (
                      <>
                        <div className="font-medium text-gray-900 truncate">
                          {result.address.name}
                        </div>
                        {result.address.type && (
                          <div className="text-xs text-gray-500 mt-1">
                            {result.address.type}
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomSearchControl;

