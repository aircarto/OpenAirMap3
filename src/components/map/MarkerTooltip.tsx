import React from "react";
import { useTranslation } from "react-i18next";
import { MeasurementDevice } from "../../types";
import { pollutants } from "../../constants/pollutants";
import { formatTooltipDate } from "../../utils/dateUtils";

interface MarkerTooltipProps {
  device: MeasurementDevice;
  position: { x: number; y: number };
  markerPosition?: { x: number; y: number };
  sensorMetadata?: {
    sensorModel?: string;
    sensorBrand?: string;
    measuredPollutants?: string[];
  };
  isHidden?: boolean;
}

/**
 * Normalise un label de polluant pour utiliser la notation avec indices
 * Cherche dans l'objet pollutants le code correspondant et retourne le nom avec indices
 * Gère les formats comme "Particules PM₁", "PM2.5", "NO₂", etc.
 */
const normalizePollutantLabel = (label: string): string => {
  const normalizedLabel = label.trim();

  // Chercher dans l'objet pollutants par nom exact (déjà au bon format)
  for (const [code, pollutant] of Object.entries(pollutants)) {
    if (pollutant.name === normalizedLabel) {
      return pollutant.name;
    }
  }

  // Chercher par correspondance partielle (pour les labels comme "Particules PM₁")
  const lowerLabel = normalizedLabel.toLowerCase();

  // Mapping des patterns courants vers les codes de polluants
  // Ordre important : chercher d'abord les patterns les plus spécifiques
  const patternMapping: Array<{ pattern: string | RegExp; code: string }> = [
    { pattern: /pm\s*2\s*\.\s*5|pm₂\.₅|pm25/gi, code: "pm25" },
    { pattern: /pm\s*10|pm₁₀/gi, code: "pm10" },
    { pattern: /pm\s*1(?:\s|$)/gi, code: "pm1" },
    { pattern: /no\s*2|no₂/gi, code: "no2" },
    { pattern: /o\s*3|o₃/gi, code: "o3" },
    { pattern: /so\s*2|so₂/gi, code: "so2" },
    { pattern: /bruit|noise/gi, code: "bruit" },
  ];

  // Chercher un pattern correspondant
  for (const { pattern, code } of patternMapping) {
    if (typeof pattern === "string") {
      if (lowerLabel.includes(pattern.toLowerCase())) {
        return pollutants[code]?.name || normalizedLabel;
      }
    } else {
      // C'est une regex
      if (pattern.test(normalizedLabel) || pattern.test(lowerLabel)) {
        return pollutants[code]?.name || normalizedLabel;
      }
    }
  }

  // Si aucun pattern trouvé, chercher dans les noms de polluants
  for (const [code, pollutant] of Object.entries(pollutants)) {
    const pollutantNameLower = pollutant.name.toLowerCase();
    // Chercher si le nom du polluant est contenu dans le label ou vice versa
    if (
      lowerLabel.includes(pollutantNameLower) ||
      pollutantNameLower.includes(
        lowerLabel.replace(/particules\s*/gi, "").trim()
      )
    ) {
      return pollutant.name;
    }
  }

  // Retourner le label original si aucune correspondance trouvée
  return normalizedLabel;
};

/**
 * Vérifie si un polluant normalisé est disponible sur OpenAirMap
 * (présent dans l'objet pollutants)
 */
const isPollutantAvailableOnOpenAirMap = (normalizedLabel: string): boolean => {
  // Vérifier si le label correspond exactement à un nom de polluant dans l'objet
  for (const [code, pollutant] of Object.entries(pollutants)) {
    if (pollutant.name === normalizedLabel) {
      return true;
    }
  }
  return false;
};

const MarkerTooltip: React.FC<MarkerTooltipProps> = ({
  device,
  position,
  markerPosition,
  sensorMetadata,
  isHidden = false,
}) => {
  const { t, i18n } = useTranslation();
  const formattedDate = formatTooltipDate(device.timestamp, t, i18n.language);

  // Déterminer les polluants mesurés et les séparer en deux catégories
  const getMeasuredPollutants = (): {
    availableOnOpenAirMap: string[];
    others: string[];
  } => {
    let normalizedPollutants: string[] = [];

    if (sensorMetadata?.measuredPollutants) {
      // Normaliser tous les labels pour utiliser la notation avec indices
      normalizedPollutants = sensorMetadata.measuredPollutants.map(
        normalizePollutantLabel
      );

      // Pour NebuleAir : toujours s'assurer que PM₁, PM₂.₅ et PM₁₀ sont présents
      if (device.source === "nebuleair") {
        const requiredPollutants = ["PM₁", "PM₂.₅", "PM₁₀"];
        requiredPollutants.forEach((required) => {
          if (!normalizedPollutants.includes(required)) {
            normalizedPollutants.push(required);
          }
        });
      }

      // Dédupliquer les polluants après normalisation
      normalizedPollutants = Array.from(new Set(normalizedPollutants));
    } else {
      // Pour les sources avec données dans le device
      // PurpleAir : PM1, PM2.5, PM10
      if (device.source === "purpleair") {
        const purpleDevice = device as MeasurementDevice & {
          pm1Value?: number;
          pm25Value?: number;
          pm10Value?: number;
        };
        if (purpleDevice.pm1Value !== undefined)
          normalizedPollutants.push("PM₁");
        if (purpleDevice.pm25Value !== undefined)
          normalizedPollutants.push("PM₂.₅");
        if (purpleDevice.pm10Value !== undefined)
          normalizedPollutants.push("PM₁₀");
      }
      // NebuleAir : mesure toujours PM₁, PM₂.₅ et PM₁₀ au minimum
      else if (device.source === "nebuleair") {
        // Toujours inclure les 3 polluants de base
        normalizedPollutants.push("PM₁");
        normalizedPollutants.push("PM₂.₅");
        normalizedPollutants.push("PM₁₀");
      }
      // Pour les autres sources, on affiche au minimum le polluant actuellement sélectionné
      else {
        const currentPollutant =
          pollutants[device.pollutant]?.name || device.pollutant;
        normalizedPollutants.push(currentPollutant);
      }
    }

    // Séparer en deux catégories
    const availableOnOpenAirMap: string[] = [];
    const others: string[] = [];

    normalizedPollutants.forEach((pollutant) => {
      if (isPollutantAvailableOnOpenAirMap(pollutant)) {
        availableOnOpenAirMap.push(pollutant);
      } else {
        others.push(pollutant);
      }
    });

    return { availableOnOpenAirMap, others };
  };

  const { availableOnOpenAirMap, others } = getMeasuredPollutants();

  // Obtenir le modèle du capteur
  const getSensorModel = (): string | null => {
    if (sensorMetadata?.sensorModel) {
      return sensorMetadata.sensorModel;
    }

    // Sensor Community : extraire depuis le nom
    if (device.source === "sensorCommunity") {
      const sensorCommunityDevice = device as MeasurementDevice & {
        manufacturer?: string;
        sensorType?: string;
      };
      if (
        sensorCommunityDevice.manufacturer &&
        sensorCommunityDevice.sensorType
      ) {
        return `${sensorCommunityDevice.manufacturer} ${sensorCommunityDevice.sensorType}`;
      }
    }

    // PurpleAir : modèle standard
    if (device.source === "purpleair") {
      return "PurpleAir";
    }

    return null;
  };

  const sensorModel = getSensorModel();

  // Ne pas rendre le tooltip si device est null (sécurité supplémentaire)
  if (!device) {
    return null;
  }

  // Calculer la position du tooltip pour qu'il ne soit JAMAIS au-dessus du marqueur
  // Si on a la position du marqueur, positionner le tooltip à côté
  let tooltipX = position.x + 30;
  let tooltipY = position.y - 60;

  if (markerPosition) {
    // Calculer la distance entre le curseur et le marqueur
    const dx = position.x - markerPosition.x;
    const dy = position.y - markerPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Si le curseur est proche du marqueur (moins de 50px), positionner le tooltip plus loin
    if (distance < 50) {
      // Positionner le tooltip à droite du marqueur avec un offset
      tooltipX = markerPosition.x + 50;
      tooltipY = markerPosition.y - 60;
    } else {
      // Sinon, utiliser la position du curseur mais s'assurer qu'on n'est pas au-dessus du marqueur
      if (Math.abs(dx) < 30 && Math.abs(dy) < 30) {
        // Si on est trop proche, décaler plus
        tooltipX = markerPosition.x + 50;
        tooltipY = markerPosition.y - 60;
      }
    }
  }

  return (
    <div
      className="marker-tooltip-container fixed rounded-lg shadow-lg p-1.5 max-w-[200px] border border-white/30 overflow-hidden"
      style={{
        left: `${tooltipX}px`, // Position calculée pour éviter d'être au-dessus du marqueur
        top: `${tooltipY}px`,
        transform: "translate(0, -100%)", // Aligner à gauche au lieu du centre
        pointerEvents: "none", // Désactiver tous les événements de pointeur
        userSelect: "none",
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none",
        display: device && !isHidden ? "block" : "none", // Masquer complètement pendant un clic
        zIndex: 9999, // Z-index élevé pour être visible
        position: "fixed",
        touchAction: "none",
      }}
    >
      {/* Couche de flou d'arrière-plan */}
      <div
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={{
          background: "rgba(255, 255, 255, 0.15)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          zIndex: -1,
          pointerEvents: "none",
          userSelect: "none",
          touchAction: "none",
        }}
      />

      {/* Contenu net */}
      <div
        className="relative text-gray-900 text-[10px] pointer-events-none"
        style={{
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          textRendering: "optimizeLegibility",
          pointerEvents: "none",
        }}
      >
        {/* Nom du capteur */}
        <div className="font-semibold mb-1 text-[11px] border-b border-gray-300/30 pb-0.5 text-gray-900 pointer-events-none">
          {device.name}
        </div>

        {/* Modèle du capteur */}
        {sensorModel && (
          <div className="mb-1 text-[10px] text-gray-800 pointer-events-none">
            <span className="font-medium pointer-events-none">{t("tooltip.model")}</span>{" "}
            <span className="pointer-events-none">{sensorModel}</span>
          </div>
        )}

        {/* Dernière mise à jour */}
        <div className="mb-1 text-[10px] text-gray-800 pointer-events-none">
          <span className="font-medium pointer-events-none">{t("tooltip.lastUpdate")}</span>{" "}
          <span className="text-gray-700 pointer-events-none">{formattedDate}</span>
        </div>

        {/* Polluants mesurés */}
        {(availableOnOpenAirMap.length > 0 || others.length > 0) && (
          <div className="mt-1 pt-1 border-t border-gray-300/30 pointer-events-none">
            {/* Polluants disponibles sur OpenAirMap */}
            {availableOnOpenAirMap.length > 0 && (
              <div className="mb-1 pointer-events-none">
                <div className="font-medium mb-0.5 text-[10px] text-gray-800 pointer-events-none">
                  {t("tooltip.pollutantsOpenAirMap")}
                </div>
                <div className="flex flex-wrap gap-0.5 pointer-events-none">
                  {availableOnOpenAirMap.map((pollutant, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center rounded bg-gray-800/40 px-1 py-0.5 text-[10px] text-gray-900 border border-gray-400/30 pointer-events-none"
                    >
                      {pollutant}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Autres polluants */}
            {others.length > 0 && (
              <div className="pointer-events-none">
                <div className="font-medium mb-0.5 text-[10px] text-gray-800 pointer-events-none">
                  {t("tooltip.otherPollutants")}
                </div>
                <div className="flex flex-wrap gap-0.5 pointer-events-none">
                  {others.map((pollutant, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center rounded bg-gray-800/40 px-1 py-0.5 text-[10px] text-gray-900 border border-gray-400/30 pointer-events-none"
                    >
                      {pollutant}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkerTooltip;
