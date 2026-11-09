import React, { memo, useMemo, useState } from "react";
import { Marker, Polygon, Polyline, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { BoatTrack, BoatTrackPoint } from "../../types";
import { createBoatIcon } from "./utils/vehicleIcons";
import { buildBoatHull } from "./utils/boatHull";
import {
  getBoatCategory,
  BoatTrailStyle,
  BOAT_TRAIL_MAX_SEGMENTS,
  BOAT_TRAIL_PREVIEW,
  BOAT_TRAIL_SELECTED,
  BOAT_HULL_MIN_ZOOM,
  BOAT_STALE_AFTER_MS,
  getBoatDisplayHeadingDeg,
} from "../../constants/boats";

interface BoatTracksProps {
  tracks: BoatTrack[];
  /** MMSI du bateau sélectionné (traîne complète mise en avant) */
  selectedBoatId?: string | null;
  /** Clic sur un bateau : ouvre le side panel de détails */
  onBoatSelect?: (track: BoatTrack) => void;
  /**
   * Longueur de la traîne des bateaux non sélectionnés (suit le pas de temps).
   * null = toute la fenêtre chargée ; 0 = aucune traîne (mode Scan).
   */
  previewMaxAgeMs?: number | null;
}

interface TrailSegment {
  positions: [number, number][];
  opacity: number;
}

/**
 * Découpe la trajectoire en tronçons contigus d'opacité croissante :
 * la traîne s'estompe vers le passé (effet "d'où vient le bateau").
 * Les points étant chronologiques, chaque tronçon reprend le dernier
 * point du précédent pour garder une ligne continue.
 */
const buildTrailSegments = (
  points: BoatTrackPoint[],
  style: BoatTrailStyle
): TrailSegment[] => {
  // En vue d'ensemble on ne garde que la traîne récente (style.maxAgeMs)
  const visiblePoints =
    style.maxAgeMs === null
      ? points
      : points.filter(
          (p) => points[points.length - 1].time - p.time <= style.maxAgeMs!
        );

  if (visiblePoints.length < 2) {
    return [];
  }

  const segmentCount = Math.min(
    BOAT_TRAIL_MAX_SEGMENTS,
    visiblePoints.length - 1
  );
  const pointsPerSegment = (visiblePoints.length - 1) / segmentCount;
  const segments: TrailSegment[] = [];

  for (let i = 0; i < segmentCount; i++) {
    const start = Math.round(i * pointsPerSegment);
    const end = Math.round((i + 1) * pointsPerSegment);
    const positions = visiblePoints
      .slice(start, end + 1)
      .map((p): [number, number] => [p.lat, p.lon]);

    if (positions.length < 2) continue;

    // Opacité linéaire du plus ancien (transparent) au plus récent (opaque)
    const progress = segmentCount === 1 ? 1 : i / (segmentCount - 1);
    const opacity =
      style.minOpacity + progress * (style.maxOpacity - style.minOpacity);

    segments.push({ positions, opacity });
  }

  return segments;
};

const BoatTrails: React.FC<{
  track: BoatTrack;
  color: string;
  isSelected: boolean;
  previewMaxAgeMs: number | null;
}> = memo(({ track, color, isSelected, previewMaxAgeMs }) => {
  // La traîne preview suit le pas de temps (sa longueur = previewMaxAgeMs) ;
  // le bateau sélectionné montre toujours toute sa trajectoire.
  const style = useMemo<BoatTrailStyle>(
    () =>
      isSelected
        ? BOAT_TRAIL_SELECTED
        : { ...BOAT_TRAIL_PREVIEW, maxAgeMs: previewMaxAgeMs },
    [isSelected, previewMaxAgeMs]
  );
  const segments = useMemo(
    () => buildTrailSegments(track.points, style),
    [track.points, style]
  );

  return (
    <>
      {/* Halo blanc sous la traîne sélectionnée pour la détacher du fond */}
      {isSelected &&
        segments.map((segment, index) => (
          <Polyline
            key={`boat-trail-halo-${track.id}-${index}`}
            positions={segment.positions}
            color="#ffffff"
            weight={style.weight + 4}
            opacity={segment.opacity * 0.7}
            smoothFactor={1}
            interactive={false}
          />
        ))}
      {segments.map((segment, index) => (
        <Polyline
          key={`boat-trail-${track.id}-${index}`}
          positions={segment.positions}
          color={color}
          weight={style.weight}
          opacity={segment.opacity}
          smoothFactor={1}
          interactive={false}
        />
      ))}
    </>
  );
});

BoatTrails.displayName = "BoatTrails";

const BoatTracks: React.FC<BoatTracksProps> = memo(
  ({
    tracks,
    selectedBoatId = null,
    onBoatSelect,
    previewMaxAgeMs = BOAT_TRAIL_PREVIEW.maxAgeMs ?? 10 * 60 * 1000,
  }) => {
    // Au-delà de BOAT_HULL_MIN_ZOOM on passe de l'icône à la coque à l'échelle.
    // On garde le zoom courant en état pour re-rendre au bon moment.
    const map = useMap();
    const [zoom, setZoom] = useState<number>(() => map.getZoom());
    useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

    const showHulls = zoom >= BOAT_HULL_MIN_ZOOM;

    return (
      <>
        {tracks.map((track) => {
          const category = getBoatCategory(track.shipType);
          const displayName = track.name ?? `MMSI ${track.id}`;
          const isSelected = track.id === selectedBoatId;

          // Coque à la vraie échelle : uniquement zoomé, avec une orientation
          // fiable et des dimensions connues ; sinon on retombe sur l'icône.
          const orientation = getBoatDisplayHeadingDeg(track);
          const hull =
            showHulls && orientation != null
              ? buildBoatHull(track, orientation)
              : null;
          const isStale =
            Date.now() - track.lastPoint.time > BOAT_STALE_AFTER_MS;

          return (
            <React.Fragment key={`boat-${track.id}`}>
              <BoatTrails
                track={track}
                color={category.color}
                isSelected={isSelected}
                previewMaxAgeMs={previewMaxAgeMs}
              />

              {hull ? (
                <Polygon
                  positions={hull}
                  pathOptions={{
                    color: "#ffffff",
                    weight: isSelected ? 2 : 1,
                    fillColor: category.color,
                    fillOpacity: isStale ? 0.45 : 0.9,
                    opacity: isStale ? 0.6 : 1,
                  }}
                  eventHandlers={{
                    click: () => {
                      onBoatSelect?.(track);
                    },
                  }}
                >
                  <Tooltip direction="top" offset={[0, -6]} opacity={0.9}>
                    <span className="font-medium">{displayName}</span>
                  </Tooltip>
                </Polygon>
              ) : (
                <Marker
                  position={[track.lastPoint.lat, track.lastPoint.lon]}
                  icon={createBoatIcon(track, isSelected)}
                  zIndexOffset={isSelected ? 1000 : 500}
                  eventHandlers={{
                    click: () => {
                      onBoatSelect?.(track);
                    },
                  }}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                    <span className="font-medium">{displayName}</span>
                  </Tooltip>
                </Marker>
              )}
            </React.Fragment>
          );
        })}
      </>
    );
  }
);

BoatTracks.displayName = "BoatTracks";

export default BoatTracks;
