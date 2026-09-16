import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Accès local via Host virtuel (ex. aircrowd.atmosud.org → 127.0.0.1 dans /etc/hosts)
  allowedDevOrigins: [
    'aircrowd.atmosud.org',
    '*.atmosud.org',
    'openairmap.fr',
    '*.openairmap.fr',
  ],
  // Le dépôt historiquement typecheck via scripts/typecheck.sh (erreurs connues).
  // Next ne doit pas bloquer le build sur ces dettes.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['geoportal-extensions-leaflet'],
  // Équivalent des proxies Vite (dev local + standalone sans nginx)
  async rewrites() {
    return [
      {
        source: '/feuxdeforet/:path*',
        destination: 'https://feuxdeforet.fr/:path*',
      },
      {
        source: '/aircarto/:path*',
        destination: 'https://api.aircarto.fr/:path*',
      },
      {
        source: '/aircrowd-wms/:path*',
        destination: 'https://preprod-geoservices.atmosud.org/aircrowd/:path*',
      },
    ];
  },
};

export default withNextIntl(nextConfig);
