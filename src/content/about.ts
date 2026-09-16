/**
 * Contenu éditorial V1 de /a-propos — à relire côté métier.
 * Traductions partielles : FR complet, EN/autres locales en anglais de repli
 * pour les locales non FR (contenu éditorial distinct des chaînes UI i18next).
 */

export type AboutOperator = 'atmosud' | 'aircarto';

type AboutContext = {
  organization: string;
  title: string;
  operator: AboutOperator;
};

type AboutSection = {
  heading: string;
  paragraphs: string[];
};

export type AboutContent = {
  title: string;
  lead: string;
  sections: AboutSection[];
};

const fr = (ctx: AboutContext): AboutContent => ({
  title: `À propos d’${ctx.title}`,
  lead: `${ctx.title} est une carte interactive open source de la qualité de l’air. Le projet est porté conjointement par AirCarto et AtmoSud.`,
  sections: [
    {
      heading: 'Le projet',
      paragraphs: [
        'OpenAirMap rassemble sur une même carte les mesures des stations de référence, des microcapteurs qualifiés et des capteurs citoyens (NebuleAir, Sensor.Community, PurpleAir, MobileAir, SignalAir, etc.).',
        'L’objectif est de rendre visibles, en temps réel et en historique, des données souvent dispersées entre plusieurs plateformes, pour les citoyens, les collectivités et les acteurs de la qualité de l’air.',
      ],
    },
    {
      heading: 'Qui opère cette instance ?',
      paragraphs: [
        ctx.operator === 'atmosud'
          ? `Cette instance (${ctx.organization}) est opérée par AtmoSud, l’observatoire de la qualité de l’air en région Provence-Alpes-Côte d’Azur. Les domaines en .atmosud.org sont gérés par AtmoSud.`
          : `Cette instance est opérée par AirCarto. Le projet OpenAirMap reste une collaboration AirCarto et AtmoSud ; l’exploitation de openairmap.fr relève d’AirCarto.`,
      ],
    },
    {
      heading: 'Comment lire la carte ?',
      paragraphs: [
        'Choisissez un polluant (PM₂.₅, PM₁₀, NO₂, O₃, etc.) et un pas de temps (scan, ≤2 min, 15 min, heure, jour). Les marqueurs colorés suivent les seuils de concentration affichés dans la légende.',
        'Vous pouvez activer ou désactiver les sources de données, explorer l’historique, superposer des couches de modélisation et consulter le détail d’un capteur ou d’une station dans le panneau latéral.',
        'Le détail des sources, licences et pas de temps disponibles reste accessible depuis le bouton Informations sur la carte.',
      ],
    },
    {
      heading: 'Partenaires et données',
      paragraphs: [
        'Les données proviennent des réseaux AtmoSud, d’AirCarto (NebuleAir, MobileAir), de Sensor.Community, PurpleAir, SignalAir et d’autres contributeurs selon les sources activées.',
        'Chaque fournisseur conserve la responsabilité de ses mesures. Les licences et conditions d’usage sont rappelées dans la modale Informations et, le cas échéant, sur les sites des producteurs.',
      ],
    },
  ],
});

const en = (ctx: AboutContext): AboutContent => ({
  title: `About ${ctx.title}`,
  lead: `${ctx.title} is an open-source interactive air-quality map. The project is jointly led by AirCarto and AtmoSud.`,
  sections: [
    {
      heading: 'The project',
      paragraphs: [
        'OpenAirMap brings together reference stations, qualified micro-sensors and citizen sensors (NebuleAir, Sensor.Community, PurpleAir, MobileAir, SignalAir, and more) on a single map.',
        'The goal is to make real-time and historical data that are usually scattered across platforms visible to citizens, local authorities and air-quality stakeholders.',
      ],
    },
    {
      heading: 'Who operates this instance?',
      paragraphs: [
        ctx.operator === 'atmosud'
          ? `This instance (${ctx.organization}) is operated by AtmoSud, the air-quality observatory for the Provence-Alpes-Côte d’Azur region. Domains under .atmosud.org are managed by AtmoSud.`
          : `This instance is operated by AirCarto. OpenAirMap remains a joint AirCarto and AtmoSud project; openairmap.fr is operated by AirCarto.`,
      ],
    },
    {
      heading: 'How to read the map',
      paragraphs: [
        'Pick a pollutant (PM₂.₅, PM₁₀, NO₂, O₃, etc.) and a time step (scan, ≤2 min, 15 min, hour, day). Coloured markers follow the concentration thresholds shown in the legend.',
        'You can toggle data sources, explore history, overlay modelling layers and open station or sensor details in the side panel.',
        'Source details, licences and supported time steps remain available from the Information button on the map.',
      ],
    },
    {
      heading: 'Partners and data',
      paragraphs: [
        'Data come from AtmoSud networks, AirCarto (NebuleAir, MobileAir), Sensor.Community, PurpleAir, SignalAir and other contributors depending on enabled sources.',
        'Each provider remains responsible for its measurements. Licences and terms are summarised in the Information modal and on the producers’ websites when applicable.',
      ],
    },
  ],
});

export const getAboutContent = (
  locale: string,
  ctx: AboutContext
): AboutContent => (locale === 'fr' ? fr(ctx) : en(ctx));
