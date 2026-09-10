import { useEffect } from 'react';

/**
 * Hook personnalisé pour poser un <link rel="canonical"> auto-référent.
 * Ignore volontairement window.location.search : l'état carte/filtres est
 * synchronisé dans les query params (voir useAppUrlSync) et ne doit pas
 * faire varier l'URL canonique de cette unique route logique.
 */
export const useCanonicalUrl = () => {
  useEffect(() => {
    const canonicalUrl = `${window.location.origin}${window.location.pathname}`;

    let canonicalLink = document.querySelector('link[rel="canonical"]');

    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }

    if (canonicalLink.getAttribute('href') !== canonicalUrl) {
      canonicalLink.setAttribute('href', canonicalUrl);
    }
  }, []);
};
