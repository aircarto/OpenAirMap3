import React, { memo } from 'react';
import { CircleMarker, Polyline } from 'react-leaflet';
import type { MeasurementDevice, MobileAirLiveSensor } from '../../types';
import { pollutants } from '../../constants/pollutants';
import { getQualityColor } from '../../constants/qualityColors';
import { MOBILEAIR_LIVE_SOURCE } from '../../constants/mobileAir';
import { buildLiveTrailSegments } from '../../utils/mobileAirLiveTrail';

export type MobileAirLiveDevice = MeasurementDevice & {
  mobileAirLive?: MobileAirLiveSensor;
};

interface MobileAirLiveMarkersProps {
  devices: MobileAirLiveDevice[];
  selectedPollutant: string;
  onLiveClick?: (device: MobileAirLiveDevice) => void;
}

/**
 * Marqueurs live Scan :
 * - fixe (`fixed === true`) : un CircleMarker sur le dernier point GPS
 * - trajet (`fixed === false`) : même tête + queue colorée (2 points précédents)
 */
const MobileAirLiveMarkers: React.FC<MobileAirLiveMarkersProps> = memo(
  ({ devices, selectedPollutant, onLiveClick }) => {
    const liveDevices = devices.filter(
      (d) => d.source === MOBILEAIR_LIVE_SOURCE
    );

    if (liveDevices.length === 0) return null;

    return (
      <>
        {liveDevices.map((device) => {
          const live = device.mobileAirLive;
          const color = getQualityColor(
            device.value,
            selectedPollutant,
            pollutants
          );
          const showTrail =
            live?.fixed === false && (live.points?.length ?? 0) >= 2;
          const segments = showTrail
            ? buildLiveTrailSegments(live!.points, selectedPollutant)
            : [];

          const clickHandlers = {
            click: () => onLiveClick?.(device),
          };

          return (
            <React.Fragment key={device.id}>
              {segments.map((segment) => (
                <React.Fragment key={`${device.id}-trail-${segment.index}`}>
                  <Polyline
                    positions={segment.positions}
                    pathOptions={{
                      color: '#ffffff',
                      weight: 7,
                      opacity: 0.85,
                      lineCap: 'round',
                      lineJoin: 'round',
                    }}
                    interactive={false}
                  />
                  <Polyline
                    positions={segment.positions}
                    pathOptions={{
                      color: segment.color,
                      weight: 4,
                      // Queue : l’ancien segment est un peu plus transparent
                      opacity: 0.55 + segment.index * 0.25,
                      lineCap: 'round',
                      lineJoin: 'round',
                    }}
                    eventHandlers={clickHandlers}
                  />
                </React.Fragment>
              ))}

              <CircleMarker
                center={[device.latitude, device.longitude]}
                radius={9}
                pathOptions={{
                  color: '#ffffff',
                  fillColor: color,
                  fillOpacity: 0.95,
                  weight: 2.5,
                  opacity: 1,
                }}
                eventHandlers={clickHandlers}
              />
            </React.Fragment>
          );
        })}
      </>
    );
  }
);

MobileAirLiveMarkers.displayName = 'MobileAirLiveMarkers';

export default MobileAirLiveMarkers;
