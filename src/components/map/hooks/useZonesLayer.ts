import { useCallback, useEffect, useRef, useState } from "react";
import { featureFlags } from "../../../config/featureFlags";
import {
  ZONE_TYPES,
  ZoneKind,
  ZoneSelection,
} from "../../../constants/zones";
import { ZonesService } from "../../../services/ZonesService";

type ZoneRecord<T> = Record<ZoneKind, T>;

const initial = <T,>(value: T): ZoneRecord<T> => ({
  airport: value,
  port: value,
  seveso: value,
});

/**
 * Gère l'affichage des couches « zones » (aéroports / ports / Seveso).
 * Chaque type a son propre interrupteur ; les données GeoJSON ne sont
 * chargées qu'au moment où l'utilisateur active le type (lazy + cache).
 */
export const useZonesLayer = () => {
  const [visible, setVisible] = useState<ZoneRecord<boolean>>(initial(false));
  const [data, setData] = useState<ZoneRecord<GeoJSON.FeatureCollection | null>>(
    initial<GeoJSON.FeatureCollection | null>(null)
  );
  const [loading, setLoading] = useState<ZoneRecord<boolean>>(initial(false));

  // Zone sélectionnée (clic) -> side panel de détails
  const [selectedZone, setSelectedZone] = useState<ZoneSelection | null>(null);
  const [panelSize, setPanelSize] = useState<
    "normal" | "fullscreen" | "hidden"
  >("normal");

  // Types déjà demandés (évite les rechargements multiples)
  const requested = useRef<Set<ZoneKind>>(new Set());

  const toggle = useCallback((kind: ZoneKind) => {
    setVisible((prev) => {
      const next = !prev[kind];
      // Masquer un type referme le panel s'il concernait ce type
      if (!next) {
        setSelectedZone((sel) => (sel?.props.kind === kind ? null : sel));
      }
      return { ...prev, [kind]: next };
    });
  }, []);

  const selectZone = useCallback((selection: ZoneSelection) => {
    setSelectedZone(selection);
    setPanelSize("normal");
  }, []);

  const closePanel = useCallback(() => setSelectedZone(null), []);

  useEffect(() => {
    ZONE_TYPES.forEach((zt) => {
      if (!visible[zt.kind] || requested.current.has(zt.kind)) {
        return;
      }
      requested.current.add(zt.kind);
      setLoading((l) => ({ ...l, [zt.kind]: true }));

      new ZonesService()
        .load(zt.kind, zt.url)
        .then((fc) => setData((d) => ({ ...d, [zt.kind]: fc })))
        .catch((error) => {
          console.error("[Zones] échec de chargement", zt.kind, error);
          // Permettre une nouvelle tentative au prochain affichage
          requested.current.delete(zt.kind);
        })
        .finally(() => setLoading((l) => ({ ...l, [zt.kind]: false })));
    });
  }, [visible]);

  const anyVisible = ZONE_TYPES.some((zt) => visible[zt.kind]);

  return {
    enabled: featureFlags.zonesLayer,
    visible,
    data,
    loading,
    toggle,
    anyVisible,
    selectedZone,
    panelSize,
    setPanelSize,
    selectZone,
    closePanel,
  };
};
