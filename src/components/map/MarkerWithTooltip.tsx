import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Marker, MarkerProps, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { MeasurementDevice } from "../../types";
import { pollutants } from "../../constants/pollutants";
import { formatTooltipDate } from "../../utils/dateUtils";
import { featureFlags } from "../../config/featureFlags";

interface MarkerWithTooltipProps extends MarkerProps {
  device: MeasurementDevice;
  sensorMetadata?: {
    sensorModel?: string;
    sensorBrand?: string;
    measuredPollutants?: string[];
  };
  minZoom?: number;
  mapRef?: React.RefObject<L.Map | null>;
}

// Composant interne pour utiliser useMap()
const MarkerTooltipContent: React.FC<{
  device: MeasurementDevice;
  sensorMetadata: any;
  minZoom: number;
  tooltipRef?: React.MutableRefObject<L.Tooltip | null>;
}> = ({ device, sensorMetadata, minZoom, tooltipRef: parentTooltipRef }) => {
  const { t, i18n } = useTranslation();
  // Toujours rendre le Tooltip pour éviter l'erreur Leaflet "this._tooltip is null".
  // L'ouverture au survol est limitée par le zoom dans handleMouseOver du parent.
  // Quand le zoom est insuffisant, on ne l'ouvre pas (voir handleMouseOver) au lieu de le démonter.

  // Normaliser un label de polluant pour utiliser la notation avec indices
  const normalizePollutantLabel = (label: string): string => {
    const normalizedLabel = label.trim();
    const lowerLabel = normalizedLabel.toLowerCase();
    
    // Mapping des patterns courants vers les codes de polluants
    const patternMapping: Array<{ pattern: string | RegExp; code: string }> = [
      { pattern: /pm\s*2\s*\.\s*5|pm₂\.₅|pm25/gi, code: "pm25" },
      { pattern: /pm\s*10|pm₁₀/gi, code: "pm10" },
      { pattern: /pm\s*1(?:\s|$)/gi, code: "pm1" },
      { pattern: /no\s*2|no₂/gi, code: "no2" },
      { pattern: /o\s*3|o₃/gi, code: "o3" },
      { pattern: /so\s*2|so₂/gi, code: "so2" },
    ];
    
    for (const { pattern, code } of patternMapping) {
      if (typeof pattern === "string") {
        if (lowerLabel.includes(pattern.toLowerCase())) {
          return pollutants[code]?.name || normalizedLabel;
        }
      } else {
        if (pattern.test(normalizedLabel) || pattern.test(lowerLabel)) {
          return pollutants[code]?.name || normalizedLabel;
        }
      }
    }
    
    for (const [code, pollutant] of Object.entries(pollutants)) {
      if (pollutant.name === normalizedLabel) {
        return pollutant.name;
      }
    }
    
    return normalizedLabel;
  };

  const formattedDate = formatTooltipDate(device.timestamp, t, i18n.language);
  
  // Obtenir le modèle du capteur
  let sensorModel: string | null = null;
  if (sensorMetadata?.sensorModel) {
    sensorModel = sensorMetadata.sensorModel;
  } else if (device.source === "purpleair") {
    sensorModel = "PurpleAir";
  }
  
  // Gérer les polluants mesurés
  let normalizedPollutants: string[] = [];
  if (sensorMetadata?.measuredPollutants) {
    normalizedPollutants = sensorMetadata.measuredPollutants.map(normalizePollutantLabel);
  } else if (device.source === "purpleair") {
    normalizedPollutants = ["PM₁", "PM₂.₅", "PM₁₀"];
  } else if (device.source === "nebuleair") {
    normalizedPollutants = ["PM₁", "PM₂.₅", "PM₁₀"];
  } else {
    const currentPollutant = pollutants[device.pollutant]?.name || device.pollutant;
    normalizedPollutants = [currentPollutant];
  }

  return (
    <Tooltip
      ref={(ref) => {
        // Stocker l'instance Leaflet native du tooltip
        if (parentTooltipRef && ref) {
          // Dans react-leaflet, la ref du Tooltip retourne l'instance Leaflet native
          const leafletTooltip = (ref as any).leafletElement || ref;
          parentTooltipRef.current = leafletTooltip as L.Tooltip;
        }
      }}
      permanent={false}
      direction="right"
      offset={[10, 0]}
      opacity={0.95}
      className="custom-leaflet-tooltip"
      interactive={false}
    >
      <div className="custom-tooltip-content">
        <div style={{ fontWeight: 600, marginBottom: 4, borderBottom: "1px solid rgba(0,0,0,0.1)", paddingBottom: 2, fontSize: 11 }}>
          {device.name}
        </div>
        {sensorModel && (
          <div style={{ marginBottom: 4, fontSize: 10 }}>
            <span style={{ fontWeight: 500 }}>{t("tooltip.model")}</span> {sensorModel}
          </div>
        )}
        <div style={{ marginBottom: 4, fontSize: 10 }}>
          <span style={{ fontWeight: 500 }}>{t("tooltip.lastUpdate")}</span> {formattedDate}
        </div>
        {normalizedPollutants.length > 0 && (
          <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid rgba(0,0,0,0.1)" }}>
            <div style={{ fontWeight: 500, marginBottom: 2, fontSize: 10 }}>{t("tooltip.measuredPollutants")}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              {normalizedPollutants.map((pollutant, idx) => (
                <span
                  key={idx}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: 4,
                    background: "rgba(0,0,0,0.4)",
                    padding: "2px 4px",
                    fontSize: 10,
                    border: "1px solid rgba(0,0,0,0.3)",
                  }}
                >
                  {pollutant}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Tooltip>
  );
};

/**
 * Composant Marker avec tooltip Leaflet natif
 * Utilise le composant Tooltip de react-leaflet pour éviter les problèmes de blocage de clics
 */
const MarkerWithTooltip: React.FC<MarkerWithTooltipProps> = ({
  device,
  sensorMetadata: externalSensorMetadata,
  minZoom = 11,
  mapRef,
  ...markerProps
}) => {
  const [loadedSensorMetadata, setLoadedSensorMetadata] = useState<{
    sensorModel?: string;
    sensorBrand?: string;
    measuredPollutants?: string[];
  } | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const tooltipInstanceRef = useRef<L.Tooltip | null>(null);
  const eventHandlersRef = useRef(markerProps.eventHandlers);
  eventHandlersRef.current = markerProps.eventHandlers;

  // Charger les métadonnées du capteur si elles ne sont pas fournies
  useEffect(() => {
    if (externalSensorMetadata) {
      setLoadedSensorMetadata(externalSensorMetadata);
      return;
    }

    const loadMetadata = async () => {
      try {
        const { getSensorMetadata } = await import(
          "../../utils/sensorMetadataUtils"
        );
        const metadata = await getSensorMetadata(device);
        setLoadedSensorMetadata(metadata);
      } catch (error) {
        console.error("Erreur lors du chargement des métadonnées:", error);
        setLoadedSensorMetadata(null);
      }
    };

    loadMetadata();
  }, [device, externalSensorMetadata]);

  // Niveau de zoom minimum pour le tooltip (null = pas de restriction, contrôlé par VITE_TOOLTIP_MIN_ZOOM)
  // Ne pas utiliser ?? minZoom : quand le flag est null (false/vide), on veut aucune restriction.
  const effectiveMinZoom = featureFlags.tooltipMinZoom;

  // Fermer le tooltip si l'utilisateur zoome en dessous du seuil (quand restriction active)
  useEffect(() => {
    if (effectiveMinZoom === null) return;
    const map = mapRef?.current;
    if (!map) return;
    const onZoomEnd = () => {
      if (map.getZoom() < effectiveMinZoom && tooltipInstanceRef.current?.isOpen()) {
        tooltipInstanceRef.current.close();
      }
    };
    map.on("zoomend", onZoomEnd);
    return () => {
      map.off("zoomend", onZoomEnd);
    };
  }, [mapRef, effectiveMinZoom]);

  // Gérer l'ouverture/fermeture du tooltip au survol
  const handleMouseOver = useCallback((e: L.LeafletMouseEvent) => {
    const map = mapRef?.current;
    if (!map) return;

    const currentZoom = map.getZoom();
    if (effectiveMinZoom !== null && currentZoom < effectiveMinZoom) {
      if (tooltipInstanceRef.current?.isOpen()) {
        tooltipInstanceRef.current.close();
      }
      return;
    }

    if (markerRef.current && tooltipInstanceRef.current) {
      if (!tooltipInstanceRef.current.isOpen()) {
        tooltipInstanceRef.current.openOn(map);
      }
    }
  }, [mapRef, effectiveMinZoom]);

  const handleMouseOut = useCallback((e: L.LeafletMouseEvent) => {
    if (tooltipInstanceRef.current && tooltipInstanceRef.current.isOpen()) {
      tooltipInstanceRef.current.close();
    }
  }, []);

  // Fermer le tooltip au clic si le zoom est sous le seuil (Leaflet peut l'ouvrir au clic/focus après nos handlers)
  // Utiliser eventHandlersRef pour toujours appeler le handler parent à jour (évite closure périmée en mode comparaison)
  const handleClick = useCallback((e: L.LeafletMouseEvent) => {
    eventHandlersRef.current?.click?.(e);
    if (effectiveMinZoom === null) return;
    const map = mapRef?.current;
    if (!map) return;
    if (map.getZoom() < effectiveMinZoom) {
      requestAnimationFrame(() => {
        if (tooltipInstanceRef.current?.isOpen()) {
          tooltipInstanceRef.current.close();
        }
      });
    }
  }, [effectiveMinZoom, mapRef]);

  const sensorMetadata = externalSensorMetadata || loadedSensorMetadata;

  // Fusionner les eventHandlers existants avec nos handlers pour le tooltip
  const mergedEventHandlers = {
    ...markerProps.eventHandlers,
    mouseover: (e: L.LeafletMouseEvent) => {
      handleMouseOver(e);
      markerProps.eventHandlers?.mouseover?.(e);
    },
    mouseout: (e: L.LeafletMouseEvent) => {
      handleMouseOut(e);
      markerProps.eventHandlers?.mouseout?.(e);
    },
    click: (e: L.LeafletMouseEvent) => {
      handleClick(e);
    },
  };

  return (
    <Marker 
      {...markerProps}
      eventHandlers={mergedEventHandlers}
      ref={(ref) => {
        markerRef.current = ref;
        // Appeler la ref originale si elle existe
        if (markerProps.ref && typeof markerProps.ref === 'function') {
          markerProps.ref(ref);
        } else if (markerProps.ref && 'current' in markerProps.ref) {
          (markerProps.ref as React.MutableRefObject<L.Marker | null>).current = ref;
        }
      }}
    >
      <MarkerTooltipContent
        device={device}
        sensorMetadata={sensorMetadata}
        minZoom={minZoom}
        tooltipRef={tooltipInstanceRef}
      />
    </Marker>
  );
};

export default MarkerWithTooltip;
