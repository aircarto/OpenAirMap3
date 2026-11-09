import { useEffect, useState } from "react";
import {
  ZoneInfoService,
  ZoneExternalInfo,
} from "../../../services/ZoneInfoService";

/**
 * Récupère (paresseusement) la photo + description d'une zone à partir de ses
 * étiquettes OSM wikipedia/wikidata. Sans étiquette, aucun appel réseau.
 */
export const useZoneInfo = (
  wikipedia: string | undefined,
  wikidata: string | undefined
) => {
  const [info, setInfo] = useState<ZoneExternalInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wikipedia && !wikidata) {
      setInfo(null);
      setLoading(false);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setInfo(null);

    new ZoneInfoService()
      .fetch({ wikipedia, wikidata })
      .then((result) => {
        if (!isCancelled) setInfo(result);
      })
      .catch(() => {
        if (!isCancelled) setInfo(null);
      })
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [wikipedia, wikidata]);

  return { info, loading };
};
