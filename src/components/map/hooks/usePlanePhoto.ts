import { useEffect, useState } from "react";
import {
  PlaneInfoService,
  PlaneExternalInfo,
} from "../../../services/PlaneInfoService";

/**
 * Récupère (paresseusement) les infos enrichies d'un avion via adsbdb :
 * photo, constructeur, propriétaire, compagnie, route (origine/destination).
 */
export const usePlanePhoto = (hex: string | null, callsign: string | null) => {
  const [info, setInfo] = useState<PlaneExternalInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hex) {
      setInfo(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setInfo(null);
    new PlaneInfoService()
      .fetch(hex, callsign)
      .then((r) => {
        if (!cancelled) setInfo(r);
      })
      .catch(() => {
        if (!cancelled) setInfo(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hex, callsign]);

  return { info, loading };
};
