import { useEffect } from 'react';
import { DomainConfig } from '../config/domainConfig';
import { buildStructuredData } from '../config/structuredData';

const STRUCTURED_DATA_SCRIPT_ID = 'structured-data-dataset';

/**
 * Hook personnalisé pour injecter/mettre à jour le JSON-LD (schema.org/Dataset)
 * décrivant l'instance courante.
 */
export const useStructuredData = (domainConfig: DomainConfig) => {
  useEffect(() => {
    const url = `${window.location.origin}${window.location.pathname}`;
    const json = JSON.stringify(buildStructuredData(domainConfig, url));

    let script = document.getElementById(
      STRUCTURED_DATA_SCRIPT_ID
    ) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = STRUCTURED_DATA_SCRIPT_ID;
      document.head.appendChild(script);
    }

    if (script.textContent !== json) {
      script.textContent = json;
    }
  }, [domainConfig]);
};
