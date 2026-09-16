import { setRequestLocale } from 'next-intl/server';
import MapAppEntry from '@/components/MapAppEntry';
import { JsonLdDataset } from '@/components/seo/JsonLdDataset';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function MapPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <JsonLdDataset />
      <MapAppEntry />
    </>
  );
}
