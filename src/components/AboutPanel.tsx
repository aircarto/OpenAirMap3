import React from "react";
import { useTranslation } from "react-i18next";
import { DomainConfig } from "../config/domainConfig";

interface AboutPanelProps {
  domainConfig: DomainConfig;
}

/**
 * Bloc de texte destiné à l'indexation, et à elle seule.
 *
 * Choix assumé : ce contenu n'est atteignable par aucun humain. Il est masqué
 * visuellement par `sr-only` et retiré de l'arbre d'accessibilité par
 * `aria-hidden`, donc invisible aux voyants comme aux lecteurs d'écran. Il
 * existe pour les robots qui n'exécutent pas de clic, en complément de
 * `<meta name="description">` et du JSON-LD.
 *
 * Ne pas le présenter comme le miroir d'une surface interactive : `infoModal.intro`
 * est certes repris par InformationModal, mais `domainConfig.description` n'est
 * rendu qu'ici. Si l'on veut un jour exposer ce texte à l'utilisateur, il faut
 * créer la surface correspondante — elle n'existe pas.
 *
 * `sr-only` plutôt que `display: none` : la technique de clip conserve le
 * contenu dans le rendu, ce que ne fait pas `display: none`.
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
