import { ImageResponse } from 'next/og';
import { getServerDomainConfig } from '@/lib/serverDomain';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';

export default async function OpenGraphImage() {
  const { domainConfig } = await getServerDomainConfig();
  const title = domainConfig.seoTitle ?? domainConfig.title;
  const org = domainConfig.organization;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          background: 'linear-gradient(135deg, #0f2744 0%, #1f3c6d 45%, #3d6eaa 100%)',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 28, opacity: 0.85, fontWeight: 500 }}>
          {org}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.15, maxWidth: 1000 }}>
            {title}
          </div>
          <div style={{ fontSize: 28, opacity: 0.9, maxWidth: 900 }}>
            {domainConfig.description.slice(0, 160)}
          </div>
        </div>
        <div style={{ fontSize: 24, opacity: 0.75 }}>OpenAirMap</div>
      </div>
    ),
    { ...size }
  );
}
