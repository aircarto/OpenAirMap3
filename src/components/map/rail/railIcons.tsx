import React from "react";

/**
 * Icônes du rail — traits de 1,5 px, grille de 24, `currentColor`.
 *
 * Dessinées ici plutôt qu'importées d'une bibliothèque : le rail n'en utilise
 * qu'une poignée, et aucune dépendance d'icônes n'est installée dans le projet.
 * Elles remplacent aussi les glyphes texte (✓, ✕) employés jusqu'ici comme
 * icônes, qui ne se localisent pas et rendent différemment selon la plateforme.
 */

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-5 w-5",
};

/** Polluant : particule centrale et satellites */
export const IconPollutant: React.FC = () => (
  <svg {...base} aria-hidden="true">
    <circle cx="12" cy="12" r="3.25" />
    <circle cx="18.5" cy="6.5" r="1.4" />
    <circle cx="5.5" cy="8" r="1.1" />
    <circle cx="7" cy="18" r="1.6" />
    <circle cx="17.5" cy="16.5" r="1.1" />
  </svg>
);

/** Sources : strates de mesure empilées */
export const IconSources: React.FC = () => (
  <svg {...base} aria-hidden="true">
    <path d="M12 3.5 3.5 8l8.5 4.5L20.5 8 12 3.5Z" />
    <path d="M3.5 12.5 12 17l8.5-4.5" />
    <path d="M3.5 16.75 12 21.25l8.5-4.5" />
  </svg>
);

/** Pas de temps : cadran */
export const IconTimeStep: React.FC = () => (
  <svg {...base} aria-hidden="true">
    <circle cx="12" cy="12" r="8.25" />
    <path d="M12 7.25V12l3.25 2" />
  </svg>
);

/** Modélisation : nappe de valeurs continue */
export const IconModeling: React.FC = () => (
  <svg {...base} aria-hidden="true">
    <path d="M3 16.5c2.5-3.5 5-3.5 7.5 0s5 3.5 7.5 0" />
    <path d="M3 11c2.5-3.5 5-3.5 7.5 0s5 3.5 7.5 0" />
    <path d="M20.5 5.5v13" />
  </svg>
);

/** Fond de carte : carte pliée. Volontairement distincte d'IconSources, dont
 *  les plans empilés étaient trop proches pour être distingués à 20 px. */
export const IconBaseLayer: React.FC = () => (
  <svg {...base} aria-hidden="true">
    <path d="M3.25 6.5 9 4.25l6 2.25 5.75-2.25v13L15 19.5 9 17.25 3.25 19.5v-13Z" />
    <path d="M9 4.25v13" />
    <path d="M15 6.5v13" />
  </svg>
);

/** Sources spéciales : signalement */
export const IconSpecialSources: React.FC = () => (
  <svg {...base} aria-hidden="true">
    <path d="M6 21V4.5" />
    <path d="M6 5.5h11l-2.25 3.5L17 12.5H6" />
  </svg>
);

/** Mode historique : retour dans le temps */
export const IconHistorical: React.FC = () => (
  <svg {...base} aria-hidden="true">
    <path d="M4 12a8 8 0 1 0 2.5-5.8" />
    <path d="M3.75 4.5V9.5h5" />
    <path d="M12 8.5V12l2.75 1.75" />
  </svg>
);

/** Langue : globe */
export const IconLanguage: React.FC = () => (
  <svg {...base} aria-hidden="true">
    <circle cx="12" cy="12" r="8.25" />
    <path d="M3.75 12h16.5" />
    <path d="M12 3.75c2.1 2.3 3.25 5.15 3.25 8.25S14.1 18.05 12 20.25c-2.1-2.2-3.25-5.15-3.25-8.25S9.9 6.05 12 3.75Z" />
  </svg>
);

/** Informations */
export const IconInfo: React.FC = () => (
  <svg {...base} aria-hidden="true">
    <circle cx="12" cy="12" r="8.25" />
    <path d="M12 11v5.25" />
    <path d="M12 7.75h.01" />
  </svg>
);

/** Rejouer le tutoriel */
export const IconTour: React.FC = () => (
  <svg {...base} aria-hidden="true">
    <circle cx="12" cy="12" r="8.25" />
    <path d="M9.75 9.25a2.25 2.25 0 1 1 2.9 2.16c-.6.2-.9.72-.9 1.34v.5" />
    <path d="M12 16.5h.01" />
  </svg>
);
