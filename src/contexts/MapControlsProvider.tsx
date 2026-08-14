import React from "react";
import {
  MapControlsContext,
  type MapControlsValue,
} from "./mapControlsContext";

/**
 * Rend l'état de contrôle applicatif disponible dans la colonne carte.
 *
 * Voir mapControlsContext.ts pour la règle de partage et les raisons pour
 * lesquelles ce contexte ne détient aucun état.
 */
export const MapControlsProvider: React.FC<{
  value: MapControlsValue;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <MapControlsContext.Provider value={value}>
    {children}
  </MapControlsContext.Provider>
);

export default MapControlsProvider;
