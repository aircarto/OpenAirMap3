import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Le dépôt historiquement typecheck via scripts/typecheck.sh (erreurs connues).
  // Next ne doit pas bloquer le build sur ces dettes.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['geoportal-extensions-leaflet'],
  // Proxies same-origin vers les APIs qui bloquent le CORS navigateur.
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/aircarto/:path*',
          destination: 'https://api.aircarto.fr/:path*',
        },
        {
          source: '/feuxdeforet/:path*',
          destination: 'https://feuxdeforet.fr/:path*',
        },
      ],
    };
  },
};

export default withNextIntl(nextConfig);
