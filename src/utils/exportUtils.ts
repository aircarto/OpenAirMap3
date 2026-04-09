/**
 * Utilitaires pour l'exportation des graphiques et données
 */

import html2canvas from "html2canvas";
import { saveAs } from "file-saver";
import { getRootById } from "@amcharts/amcharts5";
import { pollutants } from "../constants/pollutants";
import { StationInfo } from "../types";
import {
  prepareLegendForExport,
  restoreLegendAfterExport,
  type LegendExportState,
} from "../components/charts/utils/amChartsHelpers";

/**
 * Nettoie les états transitoires de survol (tooltip/cursor) avant capture.
 */
const clearTransientHoverState = async (element: HTMLElement): Promise<void> => {
  // Retirer le focus actif limite certains overlays persistants.
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  // Simuler la sortie de la souris pour fermer les tooltips liés au hover.
  element.dispatchEvent(
    new MouseEvent("mouseleave", { bubbles: true, cancelable: true, view: window })
  );
  element.dispatchEvent(
    new MouseEvent("mouseout", { bubbles: true, cancelable: true, view: window })
  );

  // Laisser un frame de rendu pour que l'UI réagisse.
  await new Promise((resolve) => setTimeout(resolve, 80));
};

/**
 * Résout la racine amCharts même si le conteneur fourni est un wrapper parent.
 */
const resolveAmChartsRootFromContainer = (container: HTMLElement): any | null => {
  if (container.id) {
    const root = getRootById(container.id);
    if (root) return root;
  }

  // MobileAir exporte un wrapper: chercher un conteneur enfant amCharts.
  const candidateNodes = Array.from(
    container.querySelectorAll<HTMLElement>("[id]")
  );

  for (const node of candidateNodes) {
    const root = getRootById(node.id);
    if (root) {
      return root;
    }
  }

  return null;
};

/**
 * Formate le pas de temps pour l'affichage
 * @param timeStep - Code du pas de temps (instantane, quartHeure, heure, jour)
 * @param sensorTimeStep - Pas de temps du capteur en secondes (optionnel, pour le mode instantane)
 * @returns string - Format lisible du pas de temps
 */
const formatTimeStepForExport = (timeStep?: string, sensorTimeStep?: number | null): string => {
  if (!timeStep) return "";
  
  switch (timeStep) {
    case "instantane":
      if (sensorTimeStep !== null && sensorTimeStep !== undefined) {
        if (sensorTimeStep < 60) {
          return `Scan: ${sensorTimeStep}s`;
        } else if (sensorTimeStep < 3600) {
          const minutes = Math.round(sensorTimeStep / 60);
          return `Scan: ${minutes}min`;
        } else if (sensorTimeStep < 86400) {
          const hours = Math.round(sensorTimeStep / 3600);
          return `Scan: ${hours}h`;
        } else {
          const days = Math.round(sensorTimeStep / 86400);
          return `Scan: ${days}j`;
        }
      }
      return "Scan";
    case "quartHeure":
      return "15 minutes";
    case "heure":
      return "Heure";
    case "jour":
      return "Jour";
    default:
      return timeStep;
  }
};

/**
 * Exporte un graphique amCharts 5 en image PNG
 * @param containerRef - Référence vers le conteneur DOM du graphique amCharts
 * @param filename - Nom du fichier (sans extension)
 * @param stationInfo - Informations de la station (optionnel)
 * @param selectedPollutants - Polluants sélectionnés (optionnel)
 * @param source - Source des données (optionnel)
 * @param stations - Stations pour le mode comparaison (optionnel)
 * @param timeStep - Pas de temps sélectionné (optionnel)
 * @param sensorTimeStep - Pas de temps du capteur en secondes (optionnel, pour le mode instantane)
 * @returns Promise<void>
 */
export const exportAmChartsAsPNG = async (
  containerRef: React.RefObject<HTMLElement | null> | React.RefObject<HTMLDivElement | null> | HTMLElement | null,
  filename: string = "graphique",
  stationInfo: StationInfo | null = null,
  selectedPollutants: string[] = [],
  source: string = "",
  stations: any[] = [],
  timeStep?: string,
  sensorTimeStep?: number | null,
  customMetadataLines: string[] = []
): Promise<void> => {
  const container = containerRef && typeof containerRef === 'object' && 'current' in containerRef 
    ? (containerRef.current as HTMLElement | null)
    : (containerRef as HTMLElement | null);

  if (!container) {
    throw new Error("Référence du conteneur du graphique non disponible");
  }

  try {
    // Attendre un peu pour s'assurer que le graphique est complètement rendu
    await new Promise((resolve) => setTimeout(resolve, 300));
    await clearTransientHoverState(container);

    const isComparisonMode = source === "comparison" && stations.length > 0;

    // Préparer la légende pour l'export : pas de scroll, grille multi-colonnes pour tout afficher
    let legendExportState: LegendExportState | null = null;
    const root = resolveAmChartsRootFromContainer(container);
    let previousTooltipContainerVisible: boolean | undefined;
    let previousCursorVisible: boolean | undefined;
    const tooltipForceHiddenState: Array<{
      tooltip: { get: (key: string) => any; set: (key: string, value: any) => void };
      previousForceHidden: any;
    }> = [];
    if (root) {
      legendExportState = prepareLegendForExport(root);
      if (legendExportState) {
        root.resize?.();
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      // Masquer les artefacts dynamiques amCharts (tooltips + curseur) pendant la capture.
      const rootAny = root as any;
      const tooltipContainer = rootAny?.tooltipContainer;
      if (tooltipContainer?.get && tooltipContainer?.set) {
        previousTooltipContainerVisible = tooltipContainer.get("visible");
        tooltipContainer.set("visible", false);
      }

      const chart = root.container.children.getIndex(0) as any;
      const cursor = chart?.get?.("cursor");
      if (cursor?.get && cursor?.set) {
        previousCursorVisible = cursor.get("visible");
        cursor.set("visible", false);
      }

      if (chart?.series?.each) {
        chart.series.each((seriesItem: any) => {
          const tooltip = seriesItem?.get?.("tooltip");
          if (tooltip?.get && tooltip?.set) {
            tooltipForceHiddenState.push({
              tooltip,
              previousForceHidden: tooltip.get("forceHidden"),
            });
            tooltip.set("forceHidden", true);
          }
        });
      }

      root.resize?.();
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    // En mode comparaison, augmenter temporairement la hauteur du conteneur pour l'export
    // afin que le graphique ne soit pas écrasé par la légende et les métadonnées
    const EXPORT_CHART_MIN_HEIGHT_PX = 560;
    let savedContainerHeight: string | null = null;
    let savedContainerMinHeight: string | null = null;
    if (isComparisonMode && container instanceof HTMLElement) {
      savedContainerHeight = container.style.height || null;
      savedContainerMinHeight = container.style.minHeight || null;
      const currentHeight = container.offsetHeight;
      if (currentHeight < EXPORT_CHART_MIN_HEIGHT_PX) {
        container.style.height = `${EXPORT_CHART_MIN_HEIGHT_PX}px`;
        container.style.minHeight = `${EXPORT_CHART_MIN_HEIGHT_PX}px`;
        if (root) {
          root.resize?.();
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    }

    // Masquer tous les tooltips d'amCharts avant la capture
    // amCharts 5 utilise des éléments avec des classes spécifiques pour les tooltips
    const tooltipSelectors = [
      '[class*="am5-Tooltip"]',
      '.am5-Tooltip',
      '[id*="Tooltip"]',
    ];
    
    const originalStyles: Array<{ element: HTMLElement; display: string; visibility: string; opacity: string }> = [];
    const foundElements = new Set<HTMLElement>();
    
    tooltipSelectors.forEach((selector) => {
      const elements = container.querySelectorAll(selector);
      if (elements) {
        elements.forEach((element) => {
          const htmlElement = element as HTMLElement;
          // Éviter de traiter le même élément plusieurs fois
          if (!foundElements.has(htmlElement)) {
            foundElements.add(htmlElement);
            originalStyles.push({
              element: htmlElement,
              display: htmlElement.style.display,
              visibility: htmlElement.style.visibility,
              opacity: htmlElement.style.opacity,
            });
            htmlElement.style.display = 'none';
            htmlElement.style.visibility = 'hidden';
            htmlElement.style.opacity = '0';
          }
        });
      }
    });

    // Masquer aussi le curseur si présent
    const cursorSelectors = [
      '[class*="am5-Cursor"]',
      '.am5-Cursor',
    ];
    cursorSelectors.forEach((selector) => {
      const elements = container.querySelectorAll(selector);
      elements.forEach((element) => {
        const htmlElement = element as HTMLElement;
        if (!foundElements.has(htmlElement)) {
          foundElements.add(htmlElement);
          originalStyles.push({
            element: htmlElement,
            display: htmlElement.style.display,
            visibility: htmlElement.style.visibility,
            opacity: htmlElement.style.opacity,
          });
          htmlElement.style.display = 'none';
          htmlElement.style.visibility = 'hidden';
          htmlElement.style.opacity = '0';
        }
      });
    });

    // Utiliser html2canvas sur le conteneur avec des options optimisées
    const canvas = await html2canvas(container, {
      background: "#ffffff",
      scale: 2, // Haute résolution
      useCORS: true,
      allowTaint: true,
      logging: false,
      ignoreElements: (element) =>
        element instanceof HTMLElement &&
        element.dataset.exportIgnore === "true",
      width: container.offsetWidth,
      height: container.offsetHeight,
      scrollX: 0,
      scrollY: 0,
      windowWidth: container.offsetWidth,
      windowHeight: container.offsetHeight,
    } as any);

    // Restaurer les styles des tooltips et curseurs après la capture
    originalStyles.forEach(({ element, display, visibility, opacity }) => {
      element.style.display = display;
      element.style.visibility = visibility;
      element.style.opacity = opacity;
    });

    // Restaurer la hauteur du conteneur
    if (savedContainerHeight !== null || savedContainerMinHeight !== null) {
      if (container instanceof HTMLElement) {
        container.style.height = savedContainerHeight ?? "";
        container.style.minHeight = savedContainerMinHeight ?? "";
      }
      if (root) root.resize?.();
    }

    // Restaurer la légende (scroll + hauteur limitée) après l'export
    if (root && legendExportState) {
      restoreLegendAfterExport(root, legendExportState);
      root.resize?.();
    }

    // Restaurer l'état dynamique amCharts après capture.
    if (root) {
      const rootAny = root as any;
      const tooltipContainer = rootAny?.tooltipContainer;
      if (
        tooltipContainer?.set &&
        typeof previousTooltipContainerVisible !== "undefined"
      ) {
        tooltipContainer.set("visible", previousTooltipContainerVisible);
      }

      const chart = root.container.children.getIndex(0) as any;
      const cursor = chart?.get?.("cursor");
      if (cursor?.set && typeof previousCursorVisible !== "undefined") {
        cursor.set("visible", previousCursorVisible);
      }

      tooltipForceHiddenState.forEach(({ tooltip, previousForceHidden }) => {
        tooltip.set("forceHidden", previousForceHidden);
      });

      root.resize?.();
    }

    // Calculer la hauteur nécessaire pour le titre et les métadonnées
    const paddingBottom = 20;
    const paddingLeft = 20;
    const paddingRight = 20;

    let paddingTop = 20;
    if (customMetadataLines.length > 0) {
      const estimatedLines = customMetadataLines.length;
      paddingTop = estimatedLines * 28 + 20;
    } else if (stationInfo) {
      // Estimer la hauteur nécessaire (approximatif)
      // Nom appareil: 1 ligne (30px) + modèle et pas de temps sur 1 ligne (25px)
      let estimatedLines = 1; // Nom de l'appareil
      if (stationInfo.sensorModel || timeStep) estimatedLines += 1; // Modèle et pas de temps sur la même ligne
      paddingTop = estimatedLines * 30 + 20; // Marge réduite
    } else if (isComparisonMode) {
      // Mode comparaison : titre + polluant + liste des stations (3 colonnes) + date
      let estimatedLines = 2; // Titre + espace
      if (selectedPollutants.length > 0) estimatedLines += 1;
      estimatedLines += Math.ceil(stations.length / 3); // Lignes en grille (3 colonnes)
      estimatedLines += 1; // Date d'export
      paddingTop = estimatedLines * 25 + 30; // Marge de sécurité
    }
    
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = canvas.width + paddingLeft + paddingRight;
    finalCanvas.height = canvas.height + paddingTop + paddingBottom;
    const ctx = finalCanvas.getContext("2d");
    
    if (!ctx) {
      throw new Error("Impossible de créer le contexte du canvas");
    }

    // Fond blanc
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

    // Fonction pour dessiner du texte centré
    const drawCenteredText = (text: string, y: number, fontSize: string = "16px", isBold: boolean = false): number => {
      ctx.font = isBold ? `bold ${fontSize} Arial, sans-serif` : `${fontSize} Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(text, finalCanvas.width / 2, y);
      return y + (isBold ? 30 : 25);
    };

    // Fonction pour découper le texte en plusieurs lignes si nécessaire (pour le mode comparaison)
    const drawText = (text: string, x: number, y: number, maxWidth: number): number => {
      const words = text.split(" ");
      let line = "";
      let currentY = y;
      
      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + " ";
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && i > 0) {
          ctx.fillText(line, x, currentY);
          line = words[i] + " ";
          currentY += 20;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x, currentY);
      return currentY + 25;
    };

    // Ajouter les métadonnées centrées au-dessus du graphique
    if (customMetadataLines.length > 0) {
      ctx.fillStyle = "#000000";
      let yOffset = 20;
      customMetadataLines.forEach((line, index) => {
        yOffset = drawCenteredText(line, yOffset, index === 0 ? "18px" : "14px", index === 0);
      });
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    } else if (stationInfo) {
      ctx.fillStyle = "#000000";
      
      let yOffset = 20;
      
      // Nom de l'appareil (en gras)
      yOffset = drawCenteredText(stationInfo.name, yOffset, "18px", true);
      
      // Modèle et pas de temps sur la même ligne (si disponibles)
      const modelText = stationInfo.sensorModel ? `Modèle: ${stationInfo.sensorModel}` : "";
      const formattedTimeStep = timeStep ? formatTimeStepForExport(timeStep, sensorTimeStep) : "";
      
      if (modelText || formattedTimeStep) {
        let combinedText = "";
        if (modelText && formattedTimeStep) {
          combinedText = `${modelText} | Pas de temps: ${formattedTimeStep}`;
        } else if (modelText) {
          combinedText = modelText;
        } else if (formattedTimeStep) {
          combinedText = `Pas de temps: ${formattedTimeStep}`;
        }
        if (combinedText) {
          yOffset = drawCenteredText(combinedText, yOffset, "14px", false);
        }
      }
      
      // Réinitialiser l'alignement pour le reste du code
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    } else if (isComparisonMode) {
      // Mode comparaison : afficher les informations de comparaison
      ctx.fillStyle = "#000000";
      ctx.font = "bold 20px Arial, sans-serif";
      
      const maxTextWidth = finalCanvas.width - paddingLeft - paddingRight;
      
      // Titre : "Comparaison de stations"
      let yOffset = drawText("Comparaison de stations", paddingLeft, 30, maxTextWidth);
      
      // Polluant comparé
      ctx.font = "14px Arial, sans-serif";
      if (selectedPollutants.length > 0) {
        const pollutantName = pollutants[selectedPollutants[0]]?.name || selectedPollutants[0];
        yOffset = drawText(`Polluant: ${pollutantName}`, paddingLeft, yOffset, maxTextWidth);
      }
      
      // Pas de temps (si disponible)
      if (timeStep) {
        const formattedTimeStep = formatTimeStepForExport(timeStep, sensorTimeStep);
        if (formattedTimeStep) {
          yOffset = drawText(`Pas de temps: ${formattedTimeStep}`, paddingLeft, yOffset, maxTextWidth);
        }
      }
      
      // Liste des appareils/stations comparées sur plusieurs colonnes
      const DEVICE_LIST_COLUMNS = 3;
      const deviceLineHeight = 25;
      yOffset = drawText(`Appareils (${stations.length}):`, paddingLeft, yOffset, maxTextWidth);
      const colCount = Math.min(DEVICE_LIST_COLUMNS, stations.length);
      const columnWidth = colCount > 0 ? maxTextWidth / colCount : maxTextWidth;
      const rowStartY = yOffset;
      ctx.font = "14px Arial, sans-serif";
      stations.forEach((station, i) => {
        const col = i % colCount;
        const row = Math.floor(i / colCount);
        const x = paddingLeft + col * columnWidth;
        const y = rowStartY + row * deviceLineHeight;
        const label = `  • ${station.name}`;
        const maxChars = Math.max(1, Math.floor((columnWidth - 10) / 8));
        const text = label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
        ctx.fillText(text, x, y);
      });
      yOffset = rowStartY + Math.ceil(stations.length / colCount) * deviceLineHeight;
      
      // Date et heure d'export
      const now = new Date();
      drawText(
        `Exporté le: ${now.toLocaleDateString("fr-FR")} à ${now.toLocaleTimeString("fr-FR")}`,
        paddingLeft,
        yOffset,
        maxTextWidth
      );
    }

    // Dessiner le graphique original
    ctx.drawImage(canvas, paddingLeft, paddingTop);

    // Convertir en blob et télécharger
    finalCanvas.toBlob(
      (blob) => {
        if (blob) {
          saveAs(blob, `${filename}.png`);
        }
      },
      "image/png",
      0.95
    );
  } catch (error) {
    console.error("Erreur lors de l'export PNG:", error);
    throw error;
  }
};

/**
 * Exporte un graphique Recharts en image PNG (déprécié - utiliser exportAmChartsAsPNG)
 * @deprecated Utiliser exportAmChartsAsPNG pour les graphiques amCharts 5
 * @param chartRef - Référence vers le composant ResponsiveContainer
 * @param filename - Nom du fichier (sans extension)
 * @param stationInfo - Informations de la station (optionnel)
 * @param selectedPollutants - Polluants sélectionnés (optionnel)
 * @param source - Source des données (optionnel)
 * @param stations - Stations pour le mode comparaison (optionnel)
 * @param timeStep - Pas de temps sélectionné (optionnel)
 * @param sensorTimeStep - Pas de temps du capteur en secondes (optionnel, pour le mode instantane)
 * @returns Promise<void>
 */
export const exportChartAsPNG = async (
  chartRef: React.RefObject<any>,
  filename: string = "graphique",
  stationInfo: StationInfo | null = null,
  selectedPollutants: string[] = [],
  source: string = "",
  stations: any[] = [],
  timeStep?: string,
  sensorTimeStep?: number | null,
  customMetadataLines: string[] = []
): Promise<void> => {
  if (!chartRef.current) {
    throw new Error("Référence du graphique non disponible");
  }

  try {
    // Attendre un peu pour s'assurer que le graphique est complètement rendu
    await new Promise((resolve) => setTimeout(resolve, 300));
    await clearTransientHoverState(chartRef.current);

    // Masquer tous les tooltips de Recharts avant la capture
    // Recharts utilise plusieurs classes possibles pour le tooltip
    const tooltipSelectors = [
      '.recharts-tooltip-wrapper',
      '.recharts-tooltip',
      '[class*="recharts-tooltip"]',
    ];
    
    const originalStyles: Array<{ element: HTMLElement; display: string; visibility: string }> = [];
    const foundElements = new Set<HTMLElement>();
    
    tooltipSelectors.forEach((selector) => {
      const elements = chartRef.current?.querySelectorAll(selector);
      if (elements) {
        elements.forEach((element) => {
          const htmlElement = element as HTMLElement;
          // Éviter de traiter le même élément plusieurs fois
          if (!foundElements.has(htmlElement)) {
            foundElements.add(htmlElement);
            originalStyles.push({
              element: htmlElement,
              display: htmlElement.style.display,
              visibility: htmlElement.style.visibility,
            });
            htmlElement.style.display = 'none';
            htmlElement.style.visibility = 'hidden';
          }
        });
      }
    });

    // Utiliser html2canvas sur le conteneur parent avec des options optimisées
    const canvas = await html2canvas(chartRef.current, {
      background: "#ffffff",
      scale: 2, // Haute résolution
      useCORS: true,
      allowTaint: true,
      logging: false,
      ignoreElements: (element) =>
        element instanceof HTMLElement &&
        element.dataset.exportIgnore === "true",
      width: chartRef.current.offsetWidth,
      height: chartRef.current.offsetHeight,
      scrollX: 0,
      scrollY: 0,
      windowWidth: chartRef.current.offsetWidth,
      windowHeight: chartRef.current.offsetHeight,
    } as any);

    // Restaurer les styles des tooltips après la capture
    originalStyles.forEach(({ element, display, visibility }) => {
      element.style.display = display;
      element.style.visibility = visibility;
    });

    // Calculer la hauteur nécessaire pour le titre et les métadonnées
    const paddingBottom = 20;
    const paddingLeft = 20;
    const paddingRight = 20;
    
    const isComparisonMode = source === "comparison" && stations.length > 0;
    
    let paddingTop = 20;
    if (customMetadataLines.length > 0) {
      const estimatedLines = customMetadataLines.length;
      paddingTop = estimatedLines * 28 + 20;
    } else if (stationInfo) {
      // Estimer la hauteur nécessaire (approximatif)
      // Nom appareil: 1 ligne (30px) + modèle et pas de temps sur 1 ligne (25px)
      let estimatedLines = 1; // Nom de l'appareil
      if (stationInfo.sensorModel || timeStep) estimatedLines += 1; // Modèle et pas de temps sur la même ligne
      paddingTop = estimatedLines * 30 + 20; // Marge réduite
    } else if (isComparisonMode) {
      // Mode comparaison : titre + polluant + liste des stations (3 colonnes) + date
      let estimatedLines = 2; // Titre + espace
      if (selectedPollutants.length > 0) estimatedLines += 1;
      estimatedLines += Math.ceil(stations.length / 3); // Lignes en grille (3 colonnes)
      estimatedLines += 1; // Date d'export
      paddingTop = estimatedLines * 25 + 30; // Marge de sécurité
    }
    
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = canvas.width + paddingLeft + paddingRight;
    finalCanvas.height = canvas.height + paddingTop + paddingBottom;
    const ctx = finalCanvas.getContext("2d");
    
    if (!ctx) {
      throw new Error("Impossible de créer le contexte du canvas");
    }

    // Fond blanc
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

    // Fonction pour dessiner du texte centré
    const drawCenteredText = (text: string, y: number, fontSize: string = "16px", isBold: boolean = false): number => {
      ctx.font = isBold ? `bold ${fontSize} Arial, sans-serif` : `${fontSize} Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(text, finalCanvas.width / 2, y);
      return y + (isBold ? 30 : 25);
    };

    // Fonction pour découper le texte en plusieurs lignes si nécessaire (pour le mode comparaison)
    const drawText = (text: string, x: number, y: number, maxWidth: number): number => {
      const words = text.split(" ");
      let line = "";
      let currentY = y;
      
      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + " ";
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && i > 0) {
          ctx.fillText(line, x, currentY);
          line = words[i] + " ";
          currentY += 20;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x, currentY);
      return currentY + 25;
    };

    // Ajouter les métadonnées centrées au-dessus du graphique
    if (customMetadataLines.length > 0) {
      ctx.fillStyle = "#000000";
      let yOffset = 20;
      customMetadataLines.forEach((line, index) => {
        yOffset = drawCenteredText(line, yOffset, index === 0 ? "18px" : "14px", index === 0);
      });
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    } else if (stationInfo) {
      ctx.fillStyle = "#000000";
      
      let yOffset = 20;
      
      // Nom de l'appareil (en gras)
      yOffset = drawCenteredText(stationInfo.name, yOffset, "18px", true);
      
      // Modèle et pas de temps sur la même ligne (si disponibles)
      const modelText = stationInfo.sensorModel ? `Modèle: ${stationInfo.sensorModel}` : "";
      const formattedTimeStep = timeStep ? formatTimeStepForExport(timeStep, sensorTimeStep) : "";
      
      if (modelText || formattedTimeStep) {
        let combinedText = "";
        if (modelText && formattedTimeStep) {
          combinedText = `${modelText} | Pas de temps: ${formattedTimeStep}`;
        } else if (modelText) {
          combinedText = modelText;
        } else if (formattedTimeStep) {
          combinedText = `Pas de temps: ${formattedTimeStep}`;
        }
        if (combinedText) {
          yOffset = drawCenteredText(combinedText, yOffset, "14px", false);
        }
      }
      
      // Réinitialiser l'alignement pour le reste du code
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    } else if (isComparisonMode) {
      // Mode comparaison : afficher les informations de comparaison
      ctx.fillStyle = "#000000";
      ctx.font = "bold 20px Arial, sans-serif";
      
      const maxTextWidth = finalCanvas.width - paddingLeft - paddingRight;
      
      // Titre : "Comparaison de stations"
      let yOffset = drawText("Comparaison de stations", paddingLeft, 30, maxTextWidth);
      
      // Polluant comparé
      ctx.font = "14px Arial, sans-serif";
      if (selectedPollutants.length > 0) {
        const pollutantName = pollutants[selectedPollutants[0]]?.name || selectedPollutants[0];
        yOffset = drawText(`Polluant: ${pollutantName}`, paddingLeft, yOffset, maxTextWidth);
      }
      
      // Pas de temps (si disponible)
      if (timeStep) {
        const formattedTimeStep = formatTimeStepForExport(timeStep, sensorTimeStep);
        if (formattedTimeStep) {
          yOffset = drawText(`Pas de temps: ${formattedTimeStep}`, paddingLeft, yOffset, maxTextWidth);
        }
      }
      
      // Liste des appareils/stations comparées sur plusieurs colonnes
      const DEVICE_LIST_COLUMNS = 3;
      const deviceLineHeight = 25;
      yOffset = drawText(`Appareils (${stations.length}):`, paddingLeft, yOffset, maxTextWidth);
      const colCount = Math.min(DEVICE_LIST_COLUMNS, stations.length);
      const columnWidth = colCount > 0 ? maxTextWidth / colCount : maxTextWidth;
      const rowStartY = yOffset;
      ctx.font = "14px Arial, sans-serif";
      stations.forEach((station, i) => {
        const col = i % colCount;
        const row = Math.floor(i / colCount);
        const x = paddingLeft + col * columnWidth;
        const y = rowStartY + row * deviceLineHeight;
        const label = `  • ${station.name}`;
        const maxChars = Math.max(1, Math.floor((columnWidth - 10) / 8));
        const text = label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
        ctx.fillText(text, x, y);
      });
      yOffset = rowStartY + Math.ceil(stations.length / colCount) * deviceLineHeight;
      
      // Date et heure d'export
      const now = new Date();
      drawText(
        `Exporté le: ${now.toLocaleDateString("fr-FR")} à ${now.toLocaleTimeString("fr-FR")}`,
        paddingLeft,
        yOffset,
        maxTextWidth
      );
    }

    // Dessiner le graphique original
    ctx.drawImage(canvas, paddingLeft, paddingTop);

    // Convertir en blob et télécharger
    finalCanvas.toBlob(
      (blob) => {
        if (blob) {
          saveAs(blob, `${filename}.png`);
        }
      },
      "image/png",
      0.95
    );
  } catch (error) {
    console.error("Erreur lors de l'export PNG:", error);
    throw error;
  }
};

// exportChartAsSVG supprimé à la demande (option SVG retirée)

/**
 * Exporte les données du graphique en CSV
 * @param data - Données du graphique
 * @param filename - Nom du fichier (sans extension)
 * @param source - Source des données (pour personnaliser les colonnes)
 * @param stations - Stations (pour le mode comparaison)
 * @param selectedPollutants - Polluants sélectionnés
 * @param stationInfo - Informations de la station (optionnel)
 * @param timeStep - Pas de temps sélectionné (optionnel)
 * @param sensorTimeStep - Pas de temps du capteur en secondes (optionnel, pour le mode instantane)
 * @returns Promise<void>
 */
export const exportDataAsCSV = (
  data: any[],
  filename: string = "donnees",
  source: string = "",
  stations: any[] = [],
  selectedPollutants: string[] = [],
  stationInfo: StationInfo | null = null,
  timeStep?: string,
  sensorTimeStep?: number | null,
  customMetadataLines: string[] = []
): void => {
  if (!data || data.length === 0) {
    throw new Error("Aucune donnée à exporter");
  }

  try {
    // Préparer les métadonnées en en-tête
    const metadataLines: string[] = [];
    const isComparisonMode = source === "comparison" && stations.length > 0;
    
    if (customMetadataLines.length > 0) {
      metadataLines.push(...customMetadataLines);
      metadataLines.push("");
    } else if (stationInfo) {
      // Nom de l'appareil
      metadataLines.push(`Appareil: ${stationInfo.name}`);
      
      // Modèle du capteur (si disponible)
      if (stationInfo.sensorModel) {
        metadataLines.push(`Modèle: ${stationInfo.sensorModel}`);
      }
      
      // Pas de temps (si disponible)
      if (timeStep) {
        const formattedTimeStep = formatTimeStepForExport(timeStep, sensorTimeStep);
        if (formattedTimeStep) {
          metadataLines.push(`Pas de temps: ${formattedTimeStep}`);
        }
      }
      
      metadataLines.push(""); // Ligne vide avant les données
    } else if (isComparisonMode) {
      // Mode comparaison : ajouter les métadonnées de comparaison
      metadataLines.push("Comparaison de stations");
      if (selectedPollutants.length > 0) {
        const pollutantName = pollutants[selectedPollutants[0]]?.name || selectedPollutants[0];
        metadataLines.push(`Polluant: ${pollutantName}`);
      }
      
      // Pas de temps (si disponible)
      if (timeStep) {
        const formattedTimeStep = formatTimeStepForExport(timeStep, sensorTimeStep);
        if (formattedTimeStep) {
          metadataLines.push(`Pas de temps: ${formattedTimeStep}`);
        }
      }
      
      metadataLines.push(`Appareils (${stations.length}):`);
      stations.forEach((station) => {
        metadataLines.push(`  • ${station.name}`);
      });
      const now = new Date();
      metadataLines.push(
        `Exporté le: ${now.toLocaleDateString("fr-FR")} à ${now.toLocaleTimeString("fr-FR")}`
      );
      metadataLines.push(""); // Ligne vide avant les données
    }

    // Fonction pour formater une date au format JJ/MM/AAAA HH:MM (en heure locale)
    // Pour correspondre à l'affichage dans le graphique qui utilise toLocaleString
    const formatDateForCSV = (dateString: string): string => {
      try {
        const date = new Date(dateString);
        // Utiliser les méthodes locales pour correspondre à l'affichage du graphique
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${day}/${month}/${year} ${hours}:${minutes}`;
      } catch (error) {
        // Si la conversion échoue, retourner la valeur originale
        return dateString;
      }
    };

    // Préparer les en-têtes de colonnes
    const headers = ["Timestamp (UTC)", "Date"];

    if (source === "comparison" && stations.length > 0) {
      // Mode comparaison : une colonne par station (comme en mode classique une colonne par polluant)
      stations.forEach((station) => {
        headers.push(station.name);
      });
    } else if (source === "atmoRef" || source === "mobileair") {
      // AtmoRef : une seule colonne par polluant (pas de distinction brut/corrigé)
      selectedPollutants.forEach((pollutant) => {
        const pollutantName = pollutants[pollutant]?.name || pollutant;
        headers.push(pollutantName);
      });
    } else {
      // Mode normal : une colonne par polluant (corrigé et brut)
      selectedPollutants.forEach((pollutant) => {
        headers.push(`${pollutant} (corrigé)`);
        headers.push(`${pollutant} (brut)`);
      });
    }

    // Convertir les données en CSV
    const csvContent = [
      ...metadataLines,
      headers.join(","),
      ...data.map((row) => {
        // Timestamp en UTC (format original ISO)
        const timestamp = row.rawTimestamp || row.timestamp;
        // Date formatée en JJ/MM/AAAA HH:MM (utiliser rawTimestamp si disponible pour avoir le format ISO)
        const dateToFormat = row.rawTimestamp || row.timestamp;
        const formattedDate = formatDateForCSV(dateToFormat);
        const values = [timestamp, formattedDate];

        if (source === "comparison" && stations.length > 0) {
          // Mode comparaison : une valeur par station dans le même ordre que les en-têtes
          stations.forEach((station) => {
            const value = row[station.id];
            // Si la valeur n'existe pas, mettre une chaîne vide
            values.push(value !== undefined && value !== null ? value : "");
          });
        } else if (source === "atmoRef" || source === "mobileair") {
          // AtmoRef/MobileAir : lire directement depuis la clé du polluant (pas de _corrected ou _raw)
          selectedPollutants.forEach((pollutant) => {
            values.push(row[pollutant] || "");
          });
        } else {
          // Mode normal : données corrigées et brutes
          selectedPollutants.forEach((pollutant) => {
            values.push(row[`${pollutant}_corrected`] || "");
            values.push(row[`${pollutant}_raw`] || "");
          });
        }

        return values
          .map((value) =>
            typeof value === "string" && value.includes(",")
              ? `"${value}"`
              : value
          )
          .join(",");
      }),
    ].join("\n");

    // Ajouter le BOM UTF-8 pour que les caractères Unicode s'affichent correctement dans Excel
    const BOM = "\uFEFF";
    const csvWithBOM = BOM + csvContent;

    // Télécharger le fichier CSV avec file-saver
    const blob = new Blob([csvWithBOM], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `${filename}.csv`);
  } catch (error) {
    console.error("Erreur lors de l'export CSV:", error);
    throw error;
  }
};

/**
 * Génère un nom de fichier basé sur la date et les paramètres
 * @param source - Source des données
 * @param selectedPollutants - Polluants sélectionnés
 * @param stations - Stations (pour le mode comparaison)
 * @param stationInfo - Informations de la station (optionnel)
 * @returns string
 */
export const generateExportFilename = (
  source: string,
  selectedPollutants: string[],
  stations: any[] = [],
  stationInfo: StationInfo | null = null
): string => {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

  let filename = `export_${dateStr}`;

  // Ajouter le nom de la station si disponible
  if (stationInfo) {
    // Nettoyer le nom de la station pour le nom de fichier (enlever caractères spéciaux)
    const cleanStationName = stationInfo.name
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .replace(/_+/g, "_")
      .substring(0, 30); // Limiter la longueur
    filename += `_${cleanStationName}`;
  }

  if (source === "comparison" && stations.length > 0) {
    filename += `_comparaison_${selectedPollutants[0] || "donnees"}`;
  } else {
    filename += `_${selectedPollutants.join("_")}`;
  }

  return filename;
};
