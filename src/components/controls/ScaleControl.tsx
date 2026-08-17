import React, { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface ScaleControlProps {
  isSidePanelOpen?: boolean;
  panelSize?: "normal" | "fullscreen" | "hidden";
}

/**
 * Composant pour afficher une échelle qui s'ajuste automatiquement selon le zoom
 * Utilise le contrôle d'échelle natif de Leaflet
 * Se cache sur mobile quand le side panel est ouvert
 */
const ScaleControl: React.FC<ScaleControlProps> = ({
  isSidePanelOpen = false,
  panelSize = "normal",
}) => {
  const map = useMap();

  useEffect(() => {
    // Créer le contrôle d'échelle
    const scaleControl = L.control.scale({
      position: "bottomleft", // Position en bas à gauche
      metric: true, // Afficher les unités métriques (km, m)
      imperial: false, // Ne pas afficher les unités impériales
      maxWidth: 120, // Largeur maximale de l'échelle (réduite pour être plus proportionnée)
    });

    // Ajouter le contrôle à la carte
    scaleControl.addTo(map);

    // Cleanup : supprimer le contrôle quand le composant est démonté
    return () => {
      scaleControl.remove();
    };
  }, [map]);

  // Visibilité pilotée par une classe sur le conteneur Leaflet, à la place d'un
  // setTimeout qui ajoutait des classes après coup — la fenêtre de 100 ms
  // laissait passer des états incohérents au montage.
  useEffect(() => {
    const element = document.querySelector(".leaflet-control-scale");
    if (!element) return;
    element.classList.toggle(
      "oam-scale-panel-open",
      isSidePanelOpen && panelSize !== "hidden"
    );
  }, [isSidePanelOpen, panelSize]);

  // Ce composant ne rend rien directement
  return null;
};

export default ScaleControl;
