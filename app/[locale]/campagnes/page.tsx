import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getServerDomainConfig } from '@/lib/serverDomain';
import CampaignsAppEntry from '@/components/campaigns/CampaignsAppEntry';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
};

/** Outil interne (utilisateurs Keycloak) : jamais indexé, absent du sitemap. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.campaigns' });
  const { domainConfig, origin } = await getServerDomainConfig();

  return {
    metadataBase: new URL(origin),
    title: `${t('metaTitle')} | ${domainConfig.title}`,
    description: t('metaDescription'),
    robots: { index: false, follow: false },
  };
}

export default async function CampaignsRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CampaignsAppEntry />;
}
