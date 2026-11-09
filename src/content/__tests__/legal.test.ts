import { describe, expect, it } from 'vitest';
import { DOMAIN_CONFIG } from '../../config/domainConfig';
import { getLegalContent } from '../legal';

const text = (locale: string, key: string) =>
  JSON.stringify(
    getLegalContent(locale, {
      domainConfig: DOMAIN_CONFIG[key],
      operator: 'aircarto',
    })
  );

describe('getLegalContent, instance AirCarto', () => {
  it.each(['fr', 'en'])('lit les données de la config de domaine (%s)', (locale) => {
    const content = text(locale, 'openairmap.fr');
    expect(content).toContain('90388552300022');
    expect(content).toContain('Paul Vuarambon');
    expect(content).toContain('39 rue Auguste Blanqui');
  });

  it.each(['fr', 'en'])("n'affiche ni identité ni ligne vide sur le domaine par défaut (%s)", (locale) => {
    const content = text(locale, 'default');
    expect(content).not.toContain('90388552300022');
    expect(content).not.toContain('undefined');
    expect(content).not.toContain('""');
  });
});
