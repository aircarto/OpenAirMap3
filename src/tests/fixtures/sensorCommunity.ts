import { SensorCommunityDataPoint } from "../../types";

export const buildSensorCommunityDataPoint = (
  overrides: Partial<SensorCommunityDataPoint> = {},
): SensorCommunityDataPoint => ({
  location: {
    country: "FR",
    altitude: 150,
    indoor: 0,
    ...overrides.location,
    id: overrides.location?.id ?? 1234,
    latitude: overrides.location?.latitude ?? "43.610769",
    longitude: overrides.location?.longitude ?? "3.876716",
  },
  sensor: {
    id: overrides.sensor?.id ?? 5678,
    pin: overrides.sensor?.pin ?? 1,
    sensor_type: {
      id: overrides.sensor?.sensor_type?.id ?? 12,
      manufacturer:
        overrides.sensor?.sensor_type?.manufacturer ?? "Luftdaten",
      name: overrides.sensor?.sensor_type?.name ?? "Nova SDS011",
      ...overrides.sensor?.sensor_type,
    },
    ...overrides.sensor,
  },
  timestamp: overrides.timestamp ?? new Date().toISOString(),
  sampling_rate: overrides.sampling_rate ?? "120",
  averaging: overrides.averaging ?? "0",
  sensordatavalues: overrides.sensordatavalues ?? [
    {
      id: 1,
      value: "12.3",
      value_type: "P1",
    },
  ],
});








