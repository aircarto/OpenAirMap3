import { useEffect, useState } from "react";
import {
  BoatInfoService,
  BoatExternalInfo,
} from "../../../services/BoatInfoService";

/**
 * Récupère (paresseusement) la photo et les liens Wikipédia/Wikidata d'un
 * navire à partir de son numéro IMO. Utilisé par le side panel bateau.
 *
 * Sans IMO (petits bateaux non immatriculés), ne fait aucun appel réseau.
 */
export const useBoatExternalInfo = (imo: number | null, lang: string) => {
  const [info, setInfo] = useState<BoatExternalInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!imo) {
      setInfo(null);
      setLoading(false);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setInfo(null);

    const service = new BoatInfoService();
    service
      .fetchByImo(imo, lang)
      .then((result) => {
        if (!isCancelled) {
          setInfo(result);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setInfo(null);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [imo, lang]);

  return { info, loading };
};
