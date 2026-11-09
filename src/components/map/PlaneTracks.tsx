import React, { memo, useMemo } from "react";
import { Marker, Polyline, Tooltip } from "react-leaflet";
import { PlaneTrack, PlaneTrackPoint } from "../../types";
import { createPlaneIcon } from "./utils/vehicleIcons";
import {
  getPlaneCategory,
  PlaneTrailStyle,
  PLANE_TRAIL_MAX_SEGMENTS,
  PLANE_TRAIL_PREVIEW,
  PLANE_TRAIL_SELECTED,
} from "../../constants/planes";

interface PlaneTracksProps {
  tracks: PlaneTrack[];
  selectedPlaneId?: string | null;
  onPlaneSelect?: (track: PlaneTrack) => void;
  previewMaxAgeMs?: number | null;
}

interface TrailSegment {
  positions: [number, number][];
  opacity: number;
}

const buildTrailSegments = (
  points: PlaneTrackPoint[],
  style: PlaneTrailStyle
): TrailSegment[] => {
  const visiblePoints =
    style.maxAgeMs === null
      ? points
      : points.filter(
          (p) => points[points.length - 1].time - p.time <= style.maxAgeMs!
        );

  if (visiblePoints.length < 2) return [];

  const segmentCount = Math.min(
    PLANE_TRAIL_MAX_SEGMENTS,
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

    const progress = segmentCount === 1 ? 1 : i / (segmentCount - 1);
    const opacity =
      style.minOpacity + progress * (style.maxOpacity - style.minOpacity);
    segments.push({ positions, opacity });
  }
  return segments;
};

const PlaneTrails: React.FC<{
  track: PlaneTrack;
  color: string;
  isSelected: boolean;
  previewMaxAgeMs: number | null;
}> = memo(({ track, color, isSelected, previewMaxAgeMs }) => {
  const style = useMemo<PlaneTrailStyle>(
    () =>
      isSelected
        ? PLANE_TRAIL_SELECTED
        : { ...PLANE_TRAIL_PREVIEW, maxAgeMs: previewMaxAgeMs },
    [isSelected, previewMaxAgeMs]
  );
  const segments = useMemo(
    () => buildTrailSegments(track.points, style),
    [track.points, style]
  );

  return (
    <>
      {isSelected &&
        segments.map((segment, index) => (
          <Polyline
            key={`plane-trail-halo-${track.id}-${index}`}
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
          key={`plane-trail-${track.id}-${index}`}
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

PlaneTrails.displayName = "PlaneTrails";

const PlaneTracks: React.FC<PlaneTracksProps> = memo(
  ({
    tracks,
    selectedPlaneId = null,
    onPlaneSelect,
    previewMaxAgeMs = PLANE_TRAIL_PREVIEW.maxAgeMs ?? 10 * 60 * 1000,
  }) => {
    return (
      <>
        {tracks.map((track) => {
          const category = getPlaneCategory(track.category, track.typeDesc);
          const displayName =
            track.callsign ?? track.registration ?? track.id.toUpperCase();
          const isSelected = track.id === selectedPlaneId;

          return (
            <React.Fragment key={`plane-${track.id}`}>
              <PlaneTrails
                track={track}
                color={category.color}
                isSelected={isSelected}
                previewMaxAgeMs={previewMaxAgeMs}
              />

              <Marker
                position={[track.lastPoint.lat, track.lastPoint.lon]}
                icon={createPlaneIcon(track, isSelected)}
                zIndexOffset={isSelected ? 1000 : 450}
                eventHandlers={{ click: () => onPlaneSelect?.(track) }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                  <span className="font-medium">{displayName}</span>
                </Tooltip>
              </Marker>
            </React.Fragment>
          );
        })}
      </>
    );
  }
);

PlaneTracks.displayName = "PlaneTracks";

export default PlaneTracks;
