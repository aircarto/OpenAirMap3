import { NextResponse } from 'next/server';
import { listAromeDomains } from '@/lib/arome';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(listAromeDomains(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[arome/domains]', error);
    return NextResponse.json(
      {
        error: 'Impossible de lister les domaines AROME',
        message: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
