import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getServerDomainConfig } from '@/lib/serverDomain';
import { isNoIndexEnabled } from '@/lib/env';
import {
  isSharedAuthConfigured,
  isSharedAuthEnabled,
  sharedAuthLoginPath,
} from '@/lib/sharedAuth';
import SharedAuthLoginForm from '@/components/auth/SharedAuthLoginForm';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
};

const sanitizeNextPath = (raw: string | undefined, locale: string): string => {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return locale === 'fr' ? '/' : `/${locale}`;
  }
  // Empêcher de reboucler sur la page login
  if (
    raw.includes('/connexion') ||
    raw.includes('/login') ||
    raw.includes('/inicio-sesion') ||
    raw.includes('/accesso') ||
    raw.includes('/anmelden')
  ) {
    return locale === 'fr' ? '/' : `/${locale}`;
  }
  return raw;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.login' });
  const { domainConfig, origin } = await getServerDomainConfig();
  const noIndex = isNoIndexEnabled() || isSharedAuthEnabled();
  const title = `${t('metaTitle')} | ${domainConfig.title}`;

  return {
    metadataBase: new URL(origin),
    title,
    description: t('metaDescription'),
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  if (!isSharedAuthEnabled()) {
    redirect(locale === 'fr' ? '/' : `/${locale}`);
  }

  const t = await getTranslations({ locale, namespace: 'pages.login' });
  const { domainConfig } = await getServerDomainConfig();
  const nextPath = sanitizeNextPath(query.next, locale);
  const logoSrc = domainConfig.logo.replace(/^\.\//, '/');
  const misconfigured = !isSharedAuthConfigured();

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-lg flex-col items-center justify-center text-center">
        <img
          src={logoSrc}
          alt={`${domainConfig.organization} logo`}
          className="mb-8 h-14 max-w-full object-contain sm:h-16"
        />
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-slate-900">
          {t('title')}
        </h1>
        <p className="mb-8 max-w-md text-sm text-slate-600">{t('subtitle')}</p>

        {misconfigured ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t('misconfigured')}
          </p>
        ) : (
          <SharedAuthLoginForm nextPath={nextPath} />
        )}

        <p className="mt-6 text-xs text-slate-400">
          {domainConfig.title}
          {' · '}
          {sharedAuthLoginPath(locale)}
        </p>
      </div>
    </main>
  );
}
