import { DomainConfig } from './domainConfig';

/**
 * Construit les données structurées JSON-LD (schema.org/Dataset) décrivant
 * l'instance courante. Fonction pure, testable sans DOM (voir useStructuredData
 * pour l'injection dans le <head>).
 *
 * temporalCoverage n'est déclaré que si `domainConfig.earliestMeasurementDate`
 * est renseigné : cette date est propre au réseau de mesure de l'instance
 * (ex: 2007-05-22 pour AtmoSud) et ne doit pas être supposée pour une instance
 * dont on ne connaît pas l'historique (ex: `default`/openairmap.fr).
 *
 * license est volontairement omis : la page "à propos" listant les licences
 * par fournisseur de données n'existe pas encore.
 */
export const buildStructuredData = (domainConfig: DomainConfig, url: string) => {
  const [[south, west], [north, east]] = domainConfig.mapBounds;

  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: domainConfig.seoTitle ?? domainConfig.title,
    description: domainConfig.description,
    url,
    creator: {
      '@type': 'Organization',
      name: domainConfig.organization,
      url: domainConfig.links.website,
    },
    spatialCoverage: {
      '@type': 'Place',
      geo: {
        '@type': 'GeoShape',
        box: `${south} ${west} ${north} ${east}`,
      },
    },
    ...(domainConfig.earliestMeasurementDate && {
      temporalCoverage: `${domainConfig.earliestMeasurementDate}/..`,
    }),
  };
};
