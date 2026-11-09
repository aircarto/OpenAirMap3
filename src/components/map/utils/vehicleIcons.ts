import L from "leaflet";
import { createElement, ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FaPlaneUp, FaHelicopter } from "react-icons/fa6";
import { BoatTrack, PlaneTrack } from "../../../types";
import {
  getBoatCategory,
  BOAT_STALE_AFTER_MS,
  getBoatDisplayHeadingDeg,
} from "../../../constants/boats";
import { getPlaneCategory, PLANE_STALE_AFTER_MS } from "../../../constants/planes";

// Icône React (Font Awesome) -> SVG string, rendu une fois et mis en cache
const svgCache = new Map<ComponentType, string>();
const iconSvg = (Icon: ComponentType): string => {
  let svg = svgCache.get(Icon);
  if (!svg) {
    svg = renderToStaticMarkup(createElement(Icon));
    svgCache.set(Icon, svg);
  }
  return svg;
};

/**
 * Marqueur bateau : silhouette de navire vue du dessus, orientée selon le cap,
 * colorée par catégorie AIS (icône d'origine, dessinée). Estompée si ancien.
 */
export const createBoatIcon = (
  track: BoatTrack,
  isSelected: boolean = false
): L.DivIcon => {
  const category = getBoatCategory(track.shipType);
  // Orientation partagée avec la coque (heading à l'arrêt, COG en route) ;
  // 0 (nord) en dernier recours pour que l'icône s'affiche toujours.
  const rotation = getBoatDisplayHeadingDeg(track) ?? 0;
  const isStale = Date.now() - track.lastPoint.time > BOAT_STALE_AFTER_MS;
  const size = isSelected ? 34 : 26;

  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" style="transform: rotate(${rotation}deg); transform-origin: center;">
      ${
        isSelected
          ? `<circle cx="12" cy="12" r="11" fill="${category.color}" fill-opacity="0.15" stroke="${category.color}" stroke-width="1.5" stroke-opacity="0.8" />`
          : ""
      }
      <path
        d="M12 1.5 L17 9 L17 20 L12 22.5 L7 20 L7 9 Z"
        fill="${category.color}"
        fill-opacity="${isStale ? 0.45 : 0.9}"
        stroke="#ffffff"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
    </svg>`;

  const container = document.createElement("div");
  container.className = "custom-marker-container boat-marker";
  container.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.4))";
  container.innerHTML = svg;

  return L.divIcon({
    html: container.outerHTML,
    className: "custom-marker-div boat-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

interface PlaneIconOptions {
  color: string;
  size: number;
  rotation: number | null;
  opacity: number;
  selected: boolean;
}

const buildPlaneDivIcon = (svg: string, o: PlaneIconOptions): L.DivIcon => {
  const rot =
    o.rotation != null
      ? `transform:rotate(${o.rotation}deg);transform-origin:center;`
      : "";
  const ring = o.selected
    ? `<span style="position:absolute;inset:-4px;border-radius:9999px;background:${o.color}1f;border:1.5px solid ${o.color};"></span>`
    : "";
  const html = `
    <div style="position:relative;width:${o.size}px;height:${o.size}px;display:flex;align-items:center;justify-content:center;">
      ${ring}
      <div style="position:relative;color:${o.color};opacity:${o.opacity};font-size:${o.size}px;line-height:0;${rot}filter:drop-shadow(0 0 1.4px #fff) drop-shadow(0 0 1px #fff) drop-shadow(0 1px 1.5px rgba(0,0,0,0.4));">
        ${svg}
      </div>
    </div>`;
  return L.divIcon({
    html,
    className: "vehicle-marker",
    iconSize: [o.size, o.size],
    iconAnchor: [o.size / 2, o.size / 2],
  });
};

/** Marqueur avion (Font Awesome) : avion orienté au cap ; hélico droit */
export const createPlaneIcon = (
  track: PlaneTrack,
  isSelected: boolean = false
): L.DivIcon => {
  const cat = getPlaneCategory(track.category, track.typeDesc);
  const isHeli = cat.key === "helicopter";
  const Icon = isHeli ? FaHelicopter : FaPlaneUp;
  const isStale = Date.now() - track.lastPoint.time > PLANE_STALE_AFTER_MS;
  return buildPlaneDivIcon(iconSvg(Icon), {
    color: cat.color,
    size: isSelected ? 26 : 20,
    rotation: isHeli ? null : track.trackDeg ?? 0,
    opacity: isStale ? 0.5 : 1,
    selected: isSelected,
  });
};
