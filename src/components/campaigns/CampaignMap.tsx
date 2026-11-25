'use client';

import React, { useEffect } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** Une localisation placée sur la carte (celles sans position n'y figurent pas). */
export interface CampaignMapSite {
  key: string;
  name: string;
  lat: number;
  lon: number;
  color: string;
  deviceCount: number;
  /** Cochée pour l'extraction ; décochée = grisée. */
  extract: boolean;
  /** Courbes affichées dans le graphique. */
  shown: boolean;
  /** Connue seulement par les mesures. */
  discovered?: boolean;
}

interface CampaignMapProps {
  sites: CampaignMapSite[];
  onClickSite: (key: string) => void;
  onHoverSite: (key: string | null) => void;
  devicesLabel: (count: number) => string;
}

const DEFAULT_CENTER: L.LatLngExpression = [43.7, 5.8]; // région PACA

/** Recadre la carte quand la liste des localisations change. */
const FitToSites: React.FC<{ sites: CampaignMapSite[] }> = ({ sites }) => {
  const map = useMap();
  const signature = sites.map((s) => s.key).join('|');
  useEffect(() => {
    if (sites.length === 0) return;
    const bounds = L.latLngBounds(sites.map((s) => [s.lat, s.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recadrage à la seule évolution de la liste
  }, [map, signature]);
  return null;
};

export const CampaignMap: React.FC<CampaignMapProps> = ({ sites, onClickSite, onHoverSite, devicesLabel }) => (
  <MapContainer center={DEFAULT_CENTER} zoom={8} className="h-full w-full" preferCanvas>
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      maxZoom={19}
    />
    <FitToSites sites={sites} />
    {sites.map((site) => (
      <CircleMarker
        key={site.key}
        center={[site.lat, site.lon]}
        radius={site.shown ? 9 : 7}
        pathOptions={{
          color: site.shown ? '#0f172a' : '#ffffff',
          weight: site.shown ? 2.5 : 1.5,
          fillColor: site.extract ? site.color : '#cbd5e1',
          fillOpacity: site.extract ? (site.shown ? 0.95 : 0.75) : 0.5,
          dashArray: site.discovered ? '3 3' : undefined,
        }}
        eventHandlers={{
          click: () => onClickSite(site.key),
          mouseover: () => onHoverSite(site.key),
          mouseout: () => onHoverSite(null),
        }}
      >
        <Tooltip direction="top" offset={[0, -6]}>
          <span className="font-medium">{site.name}</span>
          <br />
          <span className="text-xs text-slate-600">{devicesLabel(site.deviceCount)}</span>
        </Tooltip>
      </CircleMarker>
    ))}
  </MapContainer>
);

export default CampaignMap;
