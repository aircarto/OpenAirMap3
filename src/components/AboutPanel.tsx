import React from "react";
import { useTranslation } from "react-i18next";
import { DomainConfig } from "../config/domainConfig";

interface AboutPanelProps {
  domainConfig: DomainConfig;
}

/**
 * Panneau "À propos" replié par défaut (élément natif <details>) sous le header.
 * Contrairement à InformationModal (démonté du DOM tant qu'il n'est pas ouvert),
 * ce contenu reste toujours présent dans le DOM — visible pour les crawlers qui
 * n'exécutent pas de clic, même carte repliée visuellement.
 */
const AboutPanel: React.FC<AboutPanelProps> = ({ domainConfig }) => {
  const { t } = useTranslation();

  return (
    <details className="border-b border-gray-200/80 bg-gray-50/60">
      <summary className="cursor-pointer select-none px-4 sm:px-5 py-2 text-sm font-medium text-[#4271B3]">
        {t("aboutPanel.summary")}
      </summary>
      <div className="px-4 sm:px-5 pb-4 max-w-3xl space-y-2 text-sm text-gray-600">
        <p>{domainConfig.description}</p>
        <p>{t("infoModal.intro")}</p>
      </div>
    </details>
  );
};

export default AboutPanel;
