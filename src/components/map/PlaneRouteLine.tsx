import React, { useEffect, useState } from "react";
import { Polyline, CircleMarker, Tooltip } from "react-leaflet";
import { PlaneTrack } from "../../types";
import { getPlaneCategory } from "../../constants/planes";
import {
  PlaneInfoService,
  Airport,
} from "../../services/PlaneInfoService";

/**
 * Trace la route de l'avion sélectionné : aéroport d'origine ✈ position
 * actuelle ✈ aéroport de destination (ligne pointillée + points aéroports).
 * Données via adsbdb (mise en cache, partagée avec le side panel).
 */
const PlaneRouteLine: React.FC<{ plane: PlaneTrack | null }> = ({ plane }) => {
  const [route, setRoute] = useState<{
    origin: Airport | null;
    destination: Airport | null;
  } | null>(null);

  const callsign = plane?.callsign ?? null;

  useEffect(() => {
    if (!callsign) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    new PlaneInfoService()
      .getRoute(callsign)
      .then((r) => {
        if (cancelled) return;
        setRoute(
          r.origin || r.destination
            ? { origin: r.origin ?? null, destination: r.destination ?? null }
            : null
        );
      })
      .catch(() => !cancelled && setRoute(null));
    return () => {
      cancelled = true;
    };
  }, [callsign]);

  if (!plane || !route) return null;

  const { destination } = route;
  const hasDest = destination?.lat != null && destination?.lon != null;
  if (!hasDest) return null;

  const color = getPlaneCategory(plane.category, plane.typeDesc).color;
  // Pointillés uniquement vers l'arrivée : position actuelle -> destination
  const positions: [number, number][] = [
    [plane.lastPoint.lat, plane.lastPoint.lon],
    [destination!.lat!, destination!.lon!],
  ];

  return (
    <>
      <Polyline
        positions={positions}
        color={color}
        weight={2}
        dashArray="7 7"
        opacity={0.75}
        interactive={false}
      />
      <CircleMarker
        center={[destination!.lat!, destination!.lon!]}
        radius={5}
        pathOptions={{
          color,
          fillColor: color,
          fillOpacity: 0.9,
          weight: 2,
        }}
      >
        <Tooltip direction="top">
          {destination!.municipality || destination!.name} ({destination!.iata})
        </Tooltip>
      </CircleMarker>
    </>
  );
};

export default PlaneRouteLine;
