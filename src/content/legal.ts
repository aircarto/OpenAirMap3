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

const withoutEmptyBlocks = (blocks: LegalBlock[]): LegalBlock[] =>
  blocks
    .map((b) => ({ ...b, lines: b.lines.filter(Boolean) }))
    .filter((b) => b.lines.length > 0);

// Le domaine par défaut laisse le bloc `legal` vide : seules les lignes renseignées s'affichent.
const aircartoFr = (cfg: DomainConfig): LegalContent => {
  const legal = cfg.legal;
  const host = legal?.hostingProvider;
  return {
    title: 'Mentions légales',
    intro: `Informations légales relatives à l’instance ${cfg.title} opérée par AirCarto. Le projet OpenAirMap est porté par AirCarto et AtmoSud ; l’exploitation de ce domaine relève d’AirCarto.`,
    blocks: withoutEmptyBlocks([
      {
        heading: 'Éditeur',
        lines: [
          legal?.legalName
            ? `${legal.legalName}, ${legal.legalForm} au capital de ${legal.shareCapital}`
            : 'AirCarto',
          legal?.siret
            ? `RCS ${legal.rcs} — SIRET ${legal.siret} — TVA ${legal.vatNumber}`
            : '',
          legal?.address ? `Siège social : ${legal.address}` : '',
          legal?.phone ? `Téléphone : ${legal.phone}` : '',
          legal?.email
            ? `E-mail : ${legal.email}`
            : `Contact : ${cfg.links.contact}`,
          `Site : ${cfg.links.website}`,
        ],
      },
      {
        heading: 'Directeur de la publication',
        lines: [
          legal?.publicationDirector
            ? `${legal.publicationDirector}, président d’AirCarto`
            : '',
        ],
      },
      {
        heading: 'Hébergement',
        lines: [
          host?.name
            ? `Site auto-hébergé par ${host.name}, ${host.address} — ${host.phone}`
            : '',
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
    ]),
  };
};

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

const aircartoEn = (cfg: DomainConfig): LegalContent => {
  const legal = cfg.legal;
  const host = legal?.hostingProvider;
  return {
    title: 'Legal notice',
    intro: `Legal information for the ${cfg.title} instance operated by AirCarto. OpenAirMap is a joint AirCarto and AtmoSud project; this domain is operated by AirCarto.`,
    blocks: withoutEmptyBlocks([
      {
        heading: 'Publisher',
        lines: [
          legal?.legalName
            ? `${legal.legalName}, a French ${legal.legalForm} with share capital of ${legal.shareCapital}`
            : 'AirCarto',
          legal?.siret
            ? `RCS ${legal.rcs} — SIRET ${legal.siret} — VAT ${legal.vatNumber}`
            : '',
          legal?.address ? `Registered office: ${legal.address}` : '',
          legal?.phone ? `Phone: ${legal.phone}` : '',
          legal?.email
            ? `Email: ${legal.email}`
            : `Contact: ${cfg.links.contact}`,
          `Website: ${cfg.links.website}`,
        ],
      },
      {
        heading: 'Publication director',
        lines: [
          legal?.publicationDirector
            ? `${legal.publicationDirector}, President of AirCarto`
            : '',
        ],
      },
      {
        heading: 'Hosting',
        lines: [
          host?.name
            ? `Self-hosted by ${host.name}, ${host.address} — ${host.phone}`
            : '',
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
    ]),
  };
};

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
