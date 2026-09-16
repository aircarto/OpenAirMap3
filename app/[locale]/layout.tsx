import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { I18nLocaleSync } from '@/i18n/I18nLocaleSync';
import { getServerDomainConfig } from '@/lib/serverDomain';
import { isNoIndexEnabled } from '@/lib/env';
import { buildAlternates } from '@/lib/seo';

/** Host-based metadata (multi-domain) : rendu à la requête */
export const dynamic = 'force-dynamic';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { domainConfig, origin } = await getServerDomainConfig();
  const noIndex = isNoIndexEnabled();
  const title = domainConfig.seoTitle ?? domainConfig.title;
  const description = domainConfig.description;
  const favicon = domainConfig.favicon.replace(/^\.\//, '/');
  const alternates = buildAlternates({
    origin,
    locale,
    pathname: '/',
  });

  return {
    metadataBase: new URL(origin),
    title,
    description,
    icons: {
      icon: favicon,
      shortcut: favicon,
    },
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
    openGraph: {
      type: 'website',
      title,
      description,
      url: alternates.canonical,
      locale,
      siteName: domainConfig.title,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} data-locale={locale} suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/fonts/instrument-sans-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      {/* suppressHydrationWarning : extensions navigateur (ex. cz-shortcut-listen) mutent <body> avant hydrate */}
      <body suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          <I18nLocaleSync>{children}</I18nLocaleSync>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
