import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getServerDomainConfig } from '@/lib/serverDomain';
import { isNoIndexEnabled } from '@/lib/env';
import { isAtmoSudOperator } from '@/lib/domain';
import { buildAlternates, localizedPath } from '@/lib/seo';
import { getLegalContent } from '@/content/legal';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.legal' });
  const { domainConfig, origin } = await getServerDomainConfig();
  const alternates = buildAlternates({
    origin,
    locale,
    pathname: '/mentions-legales',
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

export default async function LegalPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'pages.legal' });
  const { domainConfig, hostname } = await getServerDomainConfig();
  const content = getLegalContent(locale, {
    domainConfig,
    operator: isAtmoSudOperator(hostname) ? 'atmosud' : 'aircarto',
  });
  const homeHref = localizedPath(locale, '/');
  const aboutHref = localizedPath(locale, '/a-propos');

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
        <p className="mt-4 leading-relaxed text-slate-700">{content.intro}</p>

        {content.blocks.map((block) => (
          <section key={block.heading} className="mt-10">
            <h2 className="text-xl font-semibold text-slate-900">
              {block.heading}
            </h2>
            {block.lines.map((line) => (
              <p key={line.slice(0, 48)} className="mt-2 text-slate-700">
                {line}
              </p>
            ))}
            {block.link ? (
              <p className="mt-2">
                <a
                  href={block.link.href}
                  className="text-[#1f3c6d] underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {block.link.label}
                </a>
              </p>
            ) : null}
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
            href={aboutHref}
            className="inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            {t('ctaAbout')}
          </a>
        </div>
      </div>
    </main>
  );
}
