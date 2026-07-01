import { useCallback, useEffect, useState } from "react";
import { Signalement } from "../../../types";
import { ContextService } from "../../../services/ContextService";
import { newSignalementId } from "../../../constants/context";
import { featureFlags } from "../../../config/featureFlags";

/**
 * Signalements GPS : chargement de la liste, création par clic droit
 * (« brouillon » -> popup ancré au point), et réponses. Pas de side panel :
 * tout se passe dans des popups sur la carte (ne décale pas la carte).
 */
export const useSignalements = () => {
  const enabled = featureFlags.contextComments;

  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [loading, setLoading] = useState(false);
  // Brouillon = nouveau signalement en cours (clic droit / clic en mode ajout)
  const [draft, setDraft] = useState<{ lat: number; lon: number } | null>(null);
  // Mode « ajout » : activé par le bouton, un simple clic/tap pose le signalement
  // (alternative découvrable au clic droit / appui long).
  const [placingMode, setPlacingMode] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      setSignalements(await new ContextService().getSignalements());
    } catch (e) {
      console.error("[Signalements] chargement échoué", e);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  const startDraft = useCallback((lat: number, lon: number) => {
    setDraft({ lat, lon });
    setPlacingMode(false); // un point choisi = on sort du mode ajout
  }, []);

  const cancelDraft = useCallback(() => setDraft(null), []);

  const togglePlacing = useCallback(() => setPlacingMode((v) => !v), []);
  const stopPlacing = useCallback(() => setPlacingMode(false), []);

  // Créer le signalement (premier message) depuis le brouillon
  const createSignalement = useCallback(
    async (comment: string, user: string, type?: string, datetime?: string) => {
      if (!draft) return;
      await new ContextService().postSignalement({
        id: newSignalementId(),
        lat: draft.lat,
        lon: draft.lon,
        comment,
        user,
        type,
        datetime,
      });
      setDraft(null);
      await reload();
    },
    [draft, reload]
  );

  // Ajouter une réponse à un signalement existant
  const addReply = useCallback(
    async (sig: Signalement, comment: string, user: string) => {
      await new ContextService().postSignalement({
        id: sig.id,
        lat: sig.lat,
        lon: sig.lon,
        comment,
        user,
      });
      await reload();
    },
    [reload]
  );

  return {
    enabled,
    signalements,
    loading,
    draft,
    placingMode,
    startDraft,
    cancelDraft,
    togglePlacing,
    stopPlacing,
    createSignalement,
    addReply,
    reload,
  };
};
