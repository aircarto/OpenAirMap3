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
        'AirCarto SAS, société par actions simplifiée au capital de 2 000 €',
        'RCS Marseille 903 885 523 — SIRET 903 885 523 00022 — TVA FR47903885523',
        'Siège social : 39 rue Auguste Blanqui, 13006 Marseille, France',
        'Téléphone : +33 4 91 53 90 85',
        'E-mail : contact@aircarto.fr',
        `Site : ${cfg.links.website}`,
      ],
    },
    {
      heading: 'Directeur de la publication',
      lines: ['Paul Vuarambon, président d’AirCarto'],
    },
    {
      heading: 'Hébergement',
      lines: [
        'Site auto-hébergé par AirCarto SAS, 39 rue Auguste Blanqui, 13006 Marseille, France — +33 4 91 53 90 85',
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
        'AirCarto SAS, a French société par actions simplifiée with share capital of €2,000',
        'RCS Marseille 903 885 523 — SIRET 903 885 523 00022 — VAT FR47903885523',
        'Registered office: 39 rue Auguste Blanqui, 13006 Marseille, France',
        'Phone: +33 4 91 53 90 85',
        'Email: contact@aircarto.fr',
        `Website: ${cfg.links.website}`,
      ],
    },
    {
      heading: 'Publication director',
      lines: ['Paul Vuarambon, President of AirCarto'],
    },
    {
      heading: 'Hosting',
      lines: [
        'Self-hosted by AirCarto SAS, 39 rue Auguste Blanqui, 13006 Marseille, France — +33 4 91 53 90 85',
      ],
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
