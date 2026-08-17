import React from "react";
import { useTranslation } from "react-i18next";
import { DomainConfig } from "../config/domainConfig";

interface AboutPanelProps {
  domainConfig: DomainConfig;
}

/**
 * Texte « À propos » conservé en permanence dans le DOM pour l'indexation.
 *
 * Contrairement à InformationModal, démontée tant qu'elle n'est pas ouverte, ce
 * contenu est toujours présent : il reste lisible par les robots qui n'exécutent
 * pas de clic. Il est masqué visuellement par `sr-only`, technique de clip et
 * NON `display: none` — ce dernier sortirait le contenu de l'arbre
 * d'accessibilité et n'offre pas les mêmes garanties d'indexation.
 *
 * `aria-hidden` parce que les mêmes chaînes sont rendues par InformationModal,
 * qu'ouvre le bloc de marque du rail : sans cela un lecteur d'écran les
 * annoncerait deux fois. La modale est la surface interactive « À propos » ;
 * ce bloc n'existe que pour les robots.
 */
const AboutPanel: React.FC<AboutPanelProps> = ({ domainConfig }) => {
  const { t } = useTranslation();

  return (
    <section className="sr-only" aria-hidden="true" data-testid="about-seo-text">
      <h2>{t("aboutPanel.summary")}</h2>
      <p>{domainConfig.description}</p>
      <p>{t("infoModal.intro")}</p>
    </section>
  );
};

export default AboutPanel;
