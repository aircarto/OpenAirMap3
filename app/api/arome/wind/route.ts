import { NextRequest, NextResponse } from 'next/server';
import {
  AROME_DOMAIN_DEFAULT,
  assertAromeDomain,
  extractAromeWind,
  isIsoDate,
  parseHourParam,
} from '@/lib/arome';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date')?.trim() || '';
  const hour = parseHourParam(request.nextUrl.searchParams.get('hour'));
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
    const payload = await extractAromeWind({ date, hour, domain });
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    const missing = /introuvable/i.test(message);
    const badDomain = /Domaine AROME invalide/i.test(message);
    console.error('[arome/wind]', error);
    return NextResponse.json(
      { error: 'Extraction vent AROME échouée', message },
      { status: badDomain ? 400 : missing ? 404 : 500 }
    );
  }
}
