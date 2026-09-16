import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getServerDomainConfig } from '@/lib/serverDomain';
import { isNoIndexEnabled } from '@/lib/env';
import { isAtmoSudOperator } from '@/lib/domain';
import { buildAlternates, localizedPath } from '@/lib/seo';
import { getAboutContent } from '@/content/about';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.about' });
  const { domainConfig, origin } = await getServerDomainConfig();
  const alternates = buildAlternates({
    origin,
    locale,
    pathname: '/a-propos',
  });
  const noIndex = isNoIndexEnabled();
  const title = `${t('metaTitle')} | ${domainConfig.title}`;

  return {
    metadataBase: new URL(origin),
    title,
    description: t('metaDescription'),
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
    openGraph: {
      title,
      description: t('metaDescription'),
      url: alternates.canonical,
      type: 'website',
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'pages.about' });
  const { domainConfig, hostname } = await getServerDomainConfig();
  const operator = isAtmoSudOperator(hostname) ? 'atmosud' : 'aircarto';
  const content = getAboutContent(locale, {
    organization: domainConfig.organization,
    title: domainConfig.title,
    operator,
  });
  const homeHref = localizedPath(locale, '/');
  const legalHref = localizedPath(locale, '/mentions-legales');

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="mb-6 text-sm">
          <a
            href={homeHref}
            className="font-medium text-[#1f3c6d] underline-offset-2 hover:underline"
          >
            ← {t('backToMap')}
          </a>
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[#1f3c6d]">
          {content.title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-700">
          {content.lead}
        </p>

        {content.sections.map((section) => (
          <section key={section.heading} className="mt-10">
            <h2 className="text-xl font-semibold text-slate-900">
              {section.heading}
            </h2>
            {section.paragraphs.map((p) => (
              <p
                key={p.slice(0, 40)}
                className="mt-3 leading-relaxed text-slate-700"
              >
                {p}
              </p>
            ))}
          </section>
        ))}

        <div className="mt-12 flex flex-wrap gap-4 border-t border-slate-200 pt-8">
          <a
            href={homeHref}
            className="inline-flex rounded-md bg-[#1f3c6d] px-4 py-2 text-sm font-medium text-white hover:bg-[#183055]"
          >
            {t('ctaMap')}
          </a>
          <a
            href={legalHref}
            className="inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            {t('ctaLegal')}
          </a>
        </div>
      </div>
    </main>
  );
}
