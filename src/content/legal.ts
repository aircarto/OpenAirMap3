import type { DomainConfig } from '../config/domainConfig';
import type { AboutOperator } from './about';

type LegalContext = {
  domainConfig: DomainConfig;
  operator: AboutOperator;
};

type LegalBlock = {
  heading: string;
  lines: string[];
  link?: { href: string; label: string };
};

export type LegalContent = {
  title: string;
  intro: string;
  blocks: LegalBlock[];
};

const atmosudFr = (cfg: DomainConfig): LegalContent => {
  const legal = cfg.legal;
  const host = legal?.hostingProvider;
  return {
    title: 'Mentions légales',
    intro: `Informations légales relatives à l’instance ${cfg.title} opérée par AtmoSud.`,
    blocks: [
      {
        heading: 'Éditeur',
        lines: [
          `Association AtmoSud — ${legal?.legalForm ?? 'Association loi 1901'}`,
          `SIRET : ${legal?.siret ?? '—'}`,
          legal?.vatNumber ? `TVA : ${legal.vatNumber}` : '',
          `Adresse : ${legal?.address ?? '—'}`,
          `Représentant légal : ${legal?.legalRepresentative ?? '—'}`,
          `Contact : ${cfg.links.contact}`,
        ].filter(Boolean),
      },
      {
        heading: 'Directeur de la publication',
        lines: [legal?.publicationDirector ?? cfg.organization],
      },
      {
        heading: 'Hébergement',
        lines: [
          legal?.hosting ?? 'AtmoSud',
          host
            ? `${host.name} — ${host.legalForm}, RCS ${host.rcs}, SIRET ${host.siret}, capital ${host.shareCapital}`
            : '',
          host ? `Adresse : ${host.address}` : '',
          host ? `Contact : ${host.email} — ${host.phone}` : '',
        ].filter(Boolean),
        link: host
          ? { href: host.website, label: host.website }
          : undefined,
      },
      {
        heading: 'Délégué à la protection des données',
        lines: [
          legal?.dpo
            ? `Pour exercer vos droits RGPD : ${legal.dpo}`
            : 'Contactez AtmoSud pour toute demande relative aux données personnelles.',
        ],
        link: legal?.privacyPolicyUrl
          ? {
              href: legal.privacyPolicyUrl,
              label: 'Politique de confidentialité AtmoSud',
            }
          : undefined,
      },
      {
        heading: 'Logiciel libre',
        lines: [
          'OpenAirMap est un projet open source. Le code source et les licences des composants sont décrits dans le dépôt du projet et dans la modale Informations de l’application.',
        ],
      },
    ],
  };
};

const aircartoFr = (cfg: DomainConfig): LegalContent => ({
  title: 'Mentions légales',
  intro: `Informations légales relatives à l’instance ${cfg.title} opérée par AirCarto. Le projet OpenAirMap est porté par AirCarto et AtmoSud ; l’exploitation de ce domaine relève d’AirCarto.`,
  blocks: [
    {
      heading: 'Éditeur',
      lines: [
        'AirCarto',
        'SIRET / adresse : à compléter par AirCarto (placeholder — relecture métier).',
        `Contact : ${cfg.links.contact}`,
        `Site : ${cfg.links.website}`,
      ],
    },
    {
      heading: 'Hébergement',
      lines: [
        'Hébergement et exploitation : AirCarto (détails d’hébergeur à compléter).',
      ],
    },
    {
      heading: 'Projet',
      lines: [
        'OpenAirMap est un projet open source co-porté par AirCarto et AtmoSud. Les mentions légales détaillées d’AtmoSud s’appliquent uniquement aux instances hébergées sur les domaines .atmosud.org.',
      ],
    },
    {
      heading: 'Données personnelles',
      lines: [
        'L’application cartographique affiche des mesures environnementales. Pour toute demande relative aux données personnelles, contactez l’éditeur de cette instance.',
      ],
    },
  ],
});

const atmosudEn = (cfg: DomainConfig): LegalContent => {
  const fr = atmosudFr(cfg);
  return {
    title: 'Legal notice',
    intro: `Legal information for the ${cfg.title} instance operated by AtmoSud.`,
    blocks: fr.blocks.map((b) => ({
      ...b,
      heading:
        b.heading === 'Éditeur'
          ? 'Publisher'
          : b.heading === 'Directeur de la publication'
            ? 'Publication director'
            : b.heading === 'Hébergement'
              ? 'Hosting'
              : b.heading === 'Délégué à la protection des données'
                ? 'Data protection officer'
                : b.heading === 'Logiciel libre'
                  ? 'Open source'
                  : b.heading,
    })),
  };
};

const aircartoEn = (cfg: DomainConfig): LegalContent => ({
  title: 'Legal notice',
  intro: `Legal information for the ${cfg.title} instance operated by AirCarto. OpenAirMap is a joint AirCarto and AtmoSud project; this domain is operated by AirCarto.`,
  blocks: [
    {
      heading: 'Publisher',
      lines: [
        'AirCarto',
        'SIRET / address: to be completed by AirCarto (placeholder).',
        `Contact: ${cfg.links.contact}`,
        `Website: ${cfg.links.website}`,
      ],
    },
    {
      heading: 'Hosting',
      lines: ['Hosting and operations: AirCarto (hosting provider details TBD).'],
    },
    {
      heading: 'Project',
      lines: [
        'OpenAirMap is an open-source project by AirCarto and AtmoSud. Detailed AtmoSud legal notices apply only to instances on .atmosud.org domains.',
      ],
    },
    {
      heading: 'Personal data',
      lines: [
        'The map displays environmental measurements. For personal-data requests, contact the publisher of this instance.',
      ],
    },
  ],
});

export const getLegalContent = (
  locale: string,
  ctx: LegalContext
): LegalContent => {
  if (ctx.operator === 'atmosud') {
    return locale === 'fr'
      ? atmosudFr(ctx.domainConfig)
      : atmosudEn(ctx.domainConfig);
  }
  return locale === 'fr'
    ? aircartoFr(ctx.domainConfig)
    : aircartoEn(ctx.domainConfig);
};
