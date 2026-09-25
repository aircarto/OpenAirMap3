import React, { memo } from 'react';
import { CircleMarker } from 'react-leaflet';
import type { MeasurementDevice, MobileAirLiveSensor } from '../../types';
import { pollutants } from '../../constants/pollutants';
import { getQualityColor } from '../../constants/qualityColors';
import { MOBILEAIR_LIVE_SOURCE } from '../../constants/mobileAir';

export type MobileAirLiveDevice = MeasurementDevice & {
  mobileAirLive?: MobileAirLiveSensor;
};

interface MobileAirLiveMarkersProps {
  devices: MobileAirLiveDevice[];
  selectedPollutant: string;
  onLiveClick?: (device: MobileAirLiveDevice) => void;
}

/**
 * Marqueurs live Scan : un CircleMarker par capteur (dernier point GPS).
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
          const color = getQualityColor(
            device.value,
            selectedPollutant,
            pollutants
          );
          return (
            <CircleMarker
              key={device.id}
              center={[device.latitude, device.longitude]}
              radius={9}
              pathOptions={{
                color: '#ffffff',
                fillColor: color,
                fillOpacity: 0.95,
                weight: 2.5,
                opacity: 1,
              }}
              eventHandlers={{
                click: () => onLiveClick?.(device),
              }}
            />
          );
        })}
      </>
    );
  }
);

MobileAirLiveMarkers.displayName = 'MobileAirLiveMarkers';

export default MobileAirLiveMarkers;
