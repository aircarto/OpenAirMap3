export interface MicrospotDevice {
  id: string;
  name: string;
  brand: string;
  model: string;
  aggregations: string[];
  actual_location: string | null;
  actual_location_id: string | null;
  last_measure?: string;
}

export interface MicrospotLocationCampaign {
  campaign_id: number;
  campaign_name: string;
  start_date: string;
  end_date: string | null;
}

export interface MicrospotLocation {
  id: string;
  name: string;
  typology: string;
  influence: string;
  lat: number;
  lon: number;
  alt: number | null;
  start_date: string;
  end_date: string | null;
  campaigns?: MicrospotLocationCampaign[];
}

export interface MicrospotObservationMetadata {
  device_name?: string;
  location_name?: string;
  scan_interval?: number;
  device_variables?: Array<{
    variable_id: string;
    variable_label: string;
    last_measurement_at?: string;
  }>;
}

export interface MicrospotObservation {
  id: string;
  name: string;
  location_id?: string;
  location_name?: string;
  variable_id: string;
  variable_label: string;
  time: string;
  lat: number;
  lon: number;
  value: number | null;
  value_ref: number | null;
  value_raw?: number | null;
  status_code: string;
  unit: string;
  metadata?: MicrospotObservationMetadata;
  /** Présent à la racine quand include=metadata (API Microspot) */
  scan_interval?: number;
  device_variables?: MicrospotObservationMetadata['device_variables'];
  brand?: string;
  model?: string;
}

export interface MicrospotVariable {
  id: string;
  name: string;
  unit: string;
}
