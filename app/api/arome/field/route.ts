import { NextRequest, NextResponse } from 'next/server';
import {
  AROME_DOMAIN_DEFAULT,
  assertAromeDomain,
  extractAromeField,
  isIsoDate,
  parseHourParam,
} from '@/lib/arome';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date')?.trim() || '';
  const hour = parseHourParam(request.nextUrl.searchParams.get('hour'));
  const variable = request.nextUrl.searchParams.get('var')?.trim() || 't2m';
  const rawDomain =
    request.nextUrl.searchParams.get('domain')?.trim() || AROME_DOMAIN_DEFAULT;

  if (!isIsoDate(date) || hour == null) {
    return NextResponse.json(
      { error: 'Paramètres requis: date=YYYY-MM-DD&hour=0..23' },
      { status: 400 }
    );
  }

  try {
    const domain = assertAromeDomain(rawDomain);
    const { meta, png } = await extractAromeField({
      date,
      hour,
      var: variable,
      domain,
    });
    const [south, west, north, east] = meta.bounds;
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'X-Arome-Bounds': `${south},${west},${north},${east}`,
        'X-Arome-Units': meta.units,
        'X-Arome-Min': String(meta.min),
        'X-Arome-Max': String(meta.max),
        'X-Arome-Var': meta.var,
        'X-Arome-Domain': domain,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    const missing = /introuvable|hors plage/i.test(message);
    const badDomain = /Domaine AROME invalide/i.test(message);
    console.error('[arome/field]', error);
    return NextResponse.json(
      { error: 'Extraction champ AROME échouée', message },
      { status: badDomain ? 400 : missing ? 404 : 500 }
    );
  }
}
