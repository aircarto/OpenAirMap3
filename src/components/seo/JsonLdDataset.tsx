import { getServerDomainConfig } from '@/lib/serverDomain';
import { buildStructuredData } from '@/config/structuredData';

/**
 * JSON-LD Dataset injecté côté serveur (crawlable sans JS).
 */
export async function JsonLdDataset() {
  const { domainConfig, origin } = await getServerDomainConfig();
  const data = buildStructuredData(domainConfig, `${origin}/`);

  return (
    <script
      id="structured-data-dataset"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
