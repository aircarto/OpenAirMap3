import React, { Suspense, lazy } from "react";
import { featureFlags } from "../../config/featureFlags";

const PanelCommentsContent = lazy(() => import("./PanelCommentsContent"));

/**
 * Fil de commentaires en bas d'un panneau capteur. Rien n'est rendu ni chargé
 * tant que NEXT_PUBLIC_ENABLE_CONTEXT_COMMENTS n'est pas activé.
 */
const PanelComments: React.FC<{ deviceId: string }> = ({ deviceId }) => {
  if (!featureFlags.contextComments) return null;
  return (
    <Suspense fallback={null}>
      <PanelCommentsContent deviceId={deviceId} />
    </Suspense>
  );
};

export default PanelComments;
