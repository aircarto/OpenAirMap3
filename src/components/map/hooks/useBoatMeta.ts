import { useEffect, useRef, useState } from "react";
import { BoatMeta, BoatMetaService } from "../../../services/BoatMetaService";

/**
 * Charge la fiche curée d'un navire (imo/mmsi). No-op si aucun identifiant.
 * Cache mémoire par `${imo}|${mmsi}` pour éviter de refetcher à chaque
 * ouverture du même bateau. Les métadonnées sont un bonus : en cas d'échec
 * réseau, on renvoie null sans casser le panneau.
 */
export const useBoatMeta = (imo: number | null, mmsi: string | null) => {
  const [meta, setMeta] = useState<BoatMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const cache = useRef<Map<string, BoatMeta | null>>(new Map());

  useEffect(() => {
    if (imo == null && !mmsi) {
      setMeta(null);
      return;
    }

    const key = `${imo ?? ""}|${mmsi ?? ""}`;
    if (cache.current.has(key)) {
      setMeta(cache.current.get(key) ?? null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    new BoatMetaService()
      .getByBoat(imo, mmsi)
      .then((m) => {
        if (cancelled) return;
        cache.current.set(key, m);
        setMeta(m);
      })
      .catch((e) => {
        if (cancelled) return;
        console.debug("[BoatMeta] indisponible", e);
        setMeta(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [imo, mmsi]);

  return { meta, loading };
};
