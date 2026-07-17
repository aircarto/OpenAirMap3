import L from "leaflet";
import {
  MeasurementDevice,
  SignalAirReport,
  WildfireReport,
  StationInfo,
  ComparisonState,
} from "../../../types";
import { getMarkerPath } from "../../../utils";
import { QUALITY_COLORS } from "../../../constants/qualityColors";

/**
 * Priorité des sources de données (plus le nombre est élevé, plus la priorité est haute)
 * Station de ref atmosud > Microcapteurs qualifiés atmosud > Nebuleair > le reste
 */
const SOURCE_PRIORITY: Record<string, number> = {
  atmoRef: 100,
  atmoMicro: 80,
  nebuleair: 60,
  // Toutes les autres sources ont une priorité de 0 par défaut
};

/** Valeur max utilisée pour le bonus (reste inférieure au pas entre sources = 1000) */
const MAX_VALUE_BONUS = 999;

/** Priorité très basse pour les devices sans valeur (marqueur par défaut) - passent derrière tout */
const DEFAULT_MARKER_PRIORITY = -100000;

/**
 * Vérifie si un device a une valeur valide à afficher (marqueur non-défaut)
 * Même logique que createCustomIcon pour qualityLevel === "default"
 */
const hasValidValueToDisplay = (device: MeasurementDevice): boolean =>
  device.status === "active" &&
  device.value !== null &&
  device.value !== undefined &&
  !isNaN(device.value) &&
  typeof device.value === "number";

/**
 * Calcule la priorité d'un device pour la mise en avant
 * @param device - Le device à évaluer
 * @returns Un score de priorité (plus élevé = plus prioritaire)
 *
 * La priorité est calculée en couches :
 * 1. Les devices sans valeur (marqueur par défaut) sont toujours derrière tout le reste
 * 2. La source est le critère principal (multiplié par 1000)
 * 3. La valeur mesurée (concentration) sert à départager les devices de même source (0 à 999)
 *
 * Cela garantit qu'un atmoRef sera toujours au-dessus d'un atmoMicro,
 * qui sera toujours au-dessus d'un nebuleair, les plus fortes valeurs passant devant à source égale.
 */
export const calculateDevicePriority = (device: MeasurementDevice): number => {
  // Marqueur par défaut (pas de valeur affichée) → toujours derrière tout le reste
  if (!hasValidValueToDisplay(device)) {
    return DEFAULT_MARKER_PRIORITY;
  }

  // Priorité de base selon la source (multipliée par 1000 pour être prédominante)
  const sourcePriority = (SOURCE_PRIORITY[device.source] || 0) * 1000;

  // Bonus basé sur la valeur mesurée (0 à 999) pour départager les devices de même source
  const rawValue = Math.max(0, device.value!);
  const valueBonus = Math.min(MAX_VALUE_BONUS, Math.floor(rawValue));

  return sourcePriority + valueBonus;
};

/**
 * Calcule le zIndexOffset pour un device selon sa priorité
 * @param device - Le device à évaluer
 * @returns Le zIndexOffset à appliquer au marqueur Leaflet
 */
export const calculateZIndexOffset = (device: MeasurementDevice): number => {
  const priority = calculateDevicePriority(device);
  // Convertir la priorité en zIndexOffset (les valeurs positives sont au-dessus)
  // On utilise un offset de 0 à 1000 pour les marqueurs prioritaires
  return priority;
};

/**
 * Trie les devices par priorité (les plus prioritaires en premier)
 * @param devices - Liste des devices à trier
 * @returns Liste triée par priorité décroissante
 */
export const sortDevicesByPriority = (devices: MeasurementDevice[]): MeasurementDevice[] => {
  return [...devices].sort((a, b) => {
    const priorityA = calculateDevicePriority(a);
    const priorityB = calculateDevicePriority(b);
    // Tri décroissant : les priorités les plus élevées en premier
    return priorityB - priorityA;
  });
};

interface CreateIconOptions {
  loading?: boolean;
  isSelected?: boolean;
  comparisonState?: ComparisonState;
  selectedStation?: StationInfo | null;
  wildfireLoading?: boolean;
  wildfireReportsCount?: number;
}

/**
 * Vérifie si un appareil est sélectionné
 */
export const isDeviceSelected = (
  device: MeasurementDevice,
  comparisonState: ComparisonState,
  selectedStation: StationInfo | null
): boolean => {
  // En mode comparaison, ignorer selectedStation et ne vérifier que comparedStations
  if (comparisonState.isComparisonMode) {
    return comparisonState.comparedStations.some(
      (station) => station.id === device.id
    );
  }

  // En mode normal, vérifier si l'appareil est dans le side panel normal
  if (selectedStation && selectedStation.id === device.id) {
    return true;
  }

  return false;
};

/**
 * Génère une clé unique pour les marqueurs incluant l'état de sélection
 */
export const getMarkerKey = (
  device: MeasurementDevice,
  comparisonState: ComparisonState,
  selectedStation: StationInfo | null
): string => {
  const isSelected = isDeviceSelected(device, comparisonState, selectedStation);
  // En mode comparaison, utiliser uniquement les IDs des stations comparées
  // En mode normal, utiliser l'ID de la station sélectionnée
  const selectedIds = comparisonState.isComparisonMode
    ? comparisonState.comparedStations.map((s) => s.id).sort().join(",")
    : selectedStation?.id || "";
  return `${device.id}-${isSelected ? "selected" : "unselected"}-${selectedIds}`;
};

/**
 * Crée un marqueur personnalisé pour un appareil de mesure
 */
export const createCustomIcon = (
  device: MeasurementDevice,
  options: CreateIconOptions = {}
): L.DivIcon => {
  const {
    loading = false,
    isSelected = false,
    comparisonState,
    selectedStation,
  } = options;

  // Vérifier si le device a une valeur valide pour l'affichage
  const hasValidValue =
    device.status === "active" &&
    device.value !== null &&
    device.value !== undefined &&
    !isNaN(device.value) &&
    typeof device.value === "number";

  // Utiliser "default" si le device n'a pas de valeur valide à afficher
  const qualityLevel =
    hasValidValue && device.qualityLevel ? device.qualityLevel : "default";
  const markerPath = getMarkerPath(device.source, qualityLevel);

  // Créer un élément HTML personnalisé pour le marqueur
  const div = document.createElement("div");
  div.className = `custom-marker-container ${device.source}`;
  // S'assurer que le conteneur peut recevoir les clics
  div.style.pointerEvents = "auto";
  div.style.cursor = "pointer";

  // Image de base du marqueur
  const img = document.createElement("img");
  img.src = markerPath;
  img.alt = `${device.source} marker`;

  // Vérifier si cet appareil est sélectionné et ajouter la mise en évidence
  const deviceIsSelected =
    isSelected ||
    (comparisonState
      ? isDeviceSelected(device, comparisonState, selectedStation || null)
      : false);

  if (deviceIsSelected) {
    // Utiliser la couleur correspondant au niveau de qualité
    const highlightColor = QUALITY_COLORS[qualityLevel] || "#3b82f6";

    div.style.cssText += `
      box-shadow: 0 0 0 3px ${highlightColor}, 0 0 0 6px ${highlightColor}40;
      border-radius: 50%;
      animation: pulse-${qualityLevel} 2s infinite;
    `;

    // Ajouter l'animation CSS spécifique à chaque niveau
    const style = document.createElement("style");
    style.textContent = `
      @keyframes pulse-${qualityLevel} {
        0% { 
          box-shadow: 0 0 0 3px ${highlightColor}, 0 0 0 6px ${highlightColor}40; 
        }
        50% { 
          box-shadow: 0 0 0 3px ${highlightColor}, 0 0 0 12px ${highlightColor}20; 
        }
        100% { 
          box-shadow: 0 0 0 3px ${highlightColor}, 0 0 0 6px ${highlightColor}40; 
        }
      }
    `;
    if (!document.head.querySelector(`style[data-highlight-${qualityLevel}]`)) {
      style.setAttribute(`data-highlight-${qualityLevel}`, "true");
      document.head.appendChild(style);
    }
  }

  // Ajouter une animation subtile pendant le chargement
  if (loading) {
    div.style.opacity = "0.7";
    div.style.transform = "scale(0.95)";
    div.style.transition = "all 0.3s ease";
  }

  // Texte de la valeur pour les appareils de mesure
  const valueText = document.createElement("div");
  valueText.className = "value-text";

  // Fonction pour forcer les valeurs négatives à 0
  // Les concentrations de polluants ne peuvent pas être négatives
  const ensureNonNegativeValue = (value: number | undefined | null): number | undefined => {
    // Retourner undefined/null si la valeur n'est pas définie
    if (value === undefined || value === null) return undefined;
    // Vérifier que c'est un nombre valide et forcer les négatives à 0
    if (typeof value === "number" && !isNaN(value)) {
      return Math.max(0, value);
    }
    // Si ce n'est pas un nombre valide, retourner undefined
    return undefined;
  };

  // Gestion normale pour les appareils de mesure
  // Forcer les valeurs négatives à 0 avant l'affichage
  if (device.status === "active") {
    const correctedValue = ensureNonNegativeValue(device.value);
    if (correctedValue !== undefined) {
      const displayValue = Math.round(correctedValue);
      valueText.textContent = displayValue.toString();

      // Ajuster la taille du texte selon la longueur de la valeur
      if (displayValue >= 1000) {
        valueText.style.fontSize = "10px";
      } else if (displayValue >= 100) {
        valueText.style.fontSize = "12px"; // Police plus petite pour les valeurs à 3 chiffres
      } else if (displayValue >= 10) {
        valueText.style.fontSize = "16px"; // Police moyenne pour les valeurs à 2 chiffres
      } else {
        valueText.style.fontSize = "18px"; // Police normale pour les valeurs à 1 chiffre
      }

      // Couleur du texte selon le niveau de qualité
      const textColors: Record<string, string> = {
        bon: "#000000",
        moyen: "#000000",
        degrade: "#000000",
        mauvais: "#000000", // Noir au lieu de blanc pour les marqueurs rouges
        tresMauvais: "#F2F2F2", // Noir au lieu de blanc pour les marqueurs rouges
        extrMauvais: "#F2F2F2",
        default: "#666666",
      };

      valueText.style.color = textColors[qualityLevel] || "#000000";

      // Ajouter un contour blanc pour améliorer la lisibilité
      if (qualityLevel == "extrMauvais" || qualityLevel == "tresMauvais") {
        // Contour plus subtil pour éviter l'effet de "paté"
        valueText.style.textShadow =
          "1px 1px 2px rgba(0, 0, 0, 0.8), -1px -1px 2px rgba(0, 0, 0, 0.8)";
      }

      // Indicateur de valeur corrigée pour AtmoMicro
      if (device.source === "atmoMicro" && device.has_correction) {
      // Ajouter un indicateur visuel pour les données consolidées
      const correctionIndicator = document.createElement("div");
      correctionIndicator.style.cssText = `
        position: absolute;
        top: -4px;
        right: -4px;
        width: 16px;
        height: 16px;
        background-color: rgba(59, 130, 246, 0.7);
        border-radius: 50%;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      `;

      // Ajouter l'icône Bootstrap Icons
      correctionIndicator.innerHTML = `
        <svg width="14" height="14" fill="white" viewBox="0 0 16 16">
          <path d="M5.338 1.59a61.44 61.44 0 0 0-2.837.856.481.481 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.725 10.725 0 0 0 2.287 2.233c.346.244.652.42.893.533.12.057.218.095.293.118a.55.55 0 0 0 .101.025.615.615 0 0 0 .1-.025c.076-.023.174-.061.294-.118.24-.113.547-.29.893-.533a10.726 10.726 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.775 11.775 0 0 1-2.517 2.453 7.159 7.159 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7.158 7.158 0 0 1-1.048-.625 11.777 11.777 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 62.456 62.456 0 0 1 5.072.56z"/>
          <path d="M10.854 5.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 7.793l2.646-2.647a.5.5 0 0 1 .708 0z"/>
        </svg>
      `;

      div.appendChild(correctionIndicator);
      }
    }
  }

  div.appendChild(img);
  div.appendChild(valueText);

  return L.divIcon({
    html: div.outerHTML,
    className: "custom-marker-div",
    iconSize: [32, 32],
    iconAnchor: [0, 32],
  });
};

/**
 * Crée un marqueur personnalisé pour les signalements SignalAir
 */
export const createSignalIcon = (
  report: SignalAirReport,
  loading: boolean = false
): L.DivIcon => {
  const qualityLevel = report.qualityLevel || "default";
  const markerPath = getMarkerPath(report.source, qualityLevel);

  // Créer un élément HTML personnalisé pour le marqueur de signalement
  const div = document.createElement("div");
  div.className = "custom-marker-container";

  // Image de base du marqueur
  const img = document.createElement("img");
  img.src = markerPath;
  img.alt = `${report.source} signal marker`;

  // Ajouter une animation subtile pendant le chargement
  if (loading) {
    div.style.opacity = "0.7";
    div.style.transform = "scale(0.95)";
    div.style.transition = "all 0.3s ease";
  }

  // Pour SignalAir, on n'ajoute pas de texte par-dessus le marqueur
  div.appendChild(img);

  return L.divIcon({
    html: div.outerHTML,
    className: "custom-marker-div",
    iconSize: [32, 32],
    iconAnchor: [0, 32],
  });
};

/**
 * Crée un marqueur pour les signalements d'incendies
 */
export const createWildfireIcon = (
  report: WildfireReport,
  loading: boolean = false,
  reportsCount: number = 0
): L.DivIcon => {
  const container = document.createElement("div");
  container.className = "custom-marker-container wildfire-marker";

  if (loading && reportsCount === 0) {
    container.style.opacity = "0.85";
    container.style.transform = "scale(0.96)";
    container.style.transition = "all 0.3s ease";
  }

  const img = document.createElement("img");
  img.src = "/markers/wildfire/fire_pin.svg";
  img.alt = `Incendie ${report.title}`;
  img.style.width = "24px";
  img.style.height = "24px";
  img.style.objectFit = "contain";
  img.style.filter = "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25))";

  container.appendChild(img);

  return L.divIcon({
    html: container.outerHTML,
    className: "custom-marker-div wildfire-marker",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

/**
 * Formate la date d'un signalement d'incendie
 */
export const formatWildfireDate = (report: WildfireReport): string => {
  if (report.date) {
    return new Date(report.date).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return report.dateText;
};

