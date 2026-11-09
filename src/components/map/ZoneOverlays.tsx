import React, { memo, useRef } from "react";
import { GeoJSON } from "react-leaflet";
import L from "leaflet";
import { useTranslation } from "react-i18next";
import {
  ZONE_TYPES,
  ZoneKind,
  ZoneProperties,
  ZoneSelection,
} from "../../constants/zones";

interface ZoneOverlaysProps {
  visible: Record<ZoneKind, boolean>;
  data: Record<ZoneKind, GeoJSON.FeatureCollection | null>;
  onSelect?: (selection: ZoneSelection) => void;
}

/**
 * Dessine les couches de zones (aéroports / ports / Seveso) en contours
 * pointillés colorés. Survol = nom (et seuil Seveso). Les empreintes sont des
 * polygones ; les sites Seveso sans empreinte OSM tombent en petit marqueur.
 */
const ZoneOverlays: React.FC<ZoneOverlaysProps> = memo(
  ({ visible, data, onSelect }) => {
  const { t } = useTranslation();
  // onEachFeature n'est appelé qu'à la création de la couche : la ref évite de
  // garder le gestionnaire (et son état) du premier rendu.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const escapeHtml = (value: string): string =>
    value.replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
    );

  const buildTooltip = (kind: ZoneKind, props: GeoJSON.GeoJsonProperties) => {
    const p = (props ?? {}) as Record<string, string | undefined>;
    const name = p.name ? escapeHtml(p.name) : t(`zones.types.${kind}`);
    const lines = [
      `<span style="font-weight:600">${name}</span>`,
      `<span style="color:#6b7280">${t(`zones.kind.${kind}`)}${
        p.commune ? ` · ${escapeHtml(p.commune)}` : ""
      }</span>`,
    ];
    if (kind === "seveso" && p.seuil) {
      lines.push(`<span style="color:#dc2626">${escapeHtml(p.seuil)}</span>`);
    }
    return `<div style="line-height:1.35">${lines.join("<br/>")}</div>`;
  };

  return (
    <>
      {ZONE_TYPES.map((zt) => {
        if (!visible[zt.kind] || !data[zt.kind]) {
          return null;
        }
        return (
          <GeoJSON
            key={zt.kind}
            data={data[zt.kind] as GeoJSON.FeatureCollection}
            style={() => ({
              color: zt.color,
              weight: 2,
              opacity: 0.9,
              dashArray: "6 4",
              fillColor: zt.color,
              fillOpacity: 0.1,
            })}
            // Sites Seveso sans empreinte OSM : un petit cercle au lieu d'un marqueur
            pointToLayer={(_feature, latlng) =>
              L.circleMarker(latlng, {
                radius: 7,
                color: zt.color,
                weight: 2,
                dashArray: "3 3",
                fillColor: zt.color,
                fillOpacity: 0.2,
              })
            }
            onEachFeature={(feature, layer) => {
              layer.bindTooltip(buildTooltip(zt.kind, feature.properties), {
                sticky: true,
                direction: "top",
                opacity: 0.95,
              });
              // Léger surlignage au survol + curseur main
              layer.on({
                mouseover: () =>
                  (layer as L.Path).setStyle?.({ weight: 4, fillOpacity: 0.2 }),
                mouseout: () =>
                  (layer as L.Path).setStyle?.({ weight: 2, fillOpacity: 0.1 }),
                // Clic -> ouverture du side panel de détails
                click: (e) => {
                  if (!onSelectRef.current) return;
                  const props = (feature.properties ?? {}) as ZoneProperties;
                  const ll = (e as L.LeafletMouseEvent).latlng;
                  onSelectRef.current({ props, lat: ll.lat, lon: ll.lng });
                },
              });
            }}
          />
        );
      })}
    </>
  );
  }
);

ZoneOverlays.displayName = "ZoneOverlays";

export default ZoneOverlays;
