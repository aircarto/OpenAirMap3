import { NextRequest, NextResponse } from 'next/server';
import {
  AROME_DOMAIN_DEFAULT,
  assertAromeDomain,
  listAromeDates,
} from '@/lib/arome';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const raw =
    request.nextUrl.searchParams.get('domain')?.trim() || AROME_DOMAIN_DEFAULT;
  try {
    const domain = assertAromeDomain(raw);
    const payload = await listAromeDates(domain);
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    const badDomain = /Domaine AROME invalide/i.test(message);
    console.error('[arome/dates]', error);
    return NextResponse.json(
      {
        error: 'Impossible de lister les dates AROME',
        message,
      },
      { status: badDomain ? 400 : 500 }
    );
  }
}
