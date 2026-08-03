import { useEffect } from 'react';

/**
 * Hook personnalisé pour gérer la <meta name="description"> de manière dynamique
 * @param description - Contenu de la meta description à utiliser
 */
export const useMetaDescription = (description: string) => {
  useEffect(() => {
    if (!description) return;

    let metaDescription = document.querySelector('meta[name="description"]');

    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }

    if (metaDescription.getAttribute('content') !== description) {
      metaDescription.setAttribute('content', description);
    }
  }, [description]);
};
