import { NextRequest, NextResponse } from 'next/server';
import { fetchDpobs } from '@/lib/meteofrance';

export const dynamic = 'force-dynamic';

/**
 * Proxy DPObs : le navigateur appelle `/api/meteofrance/...` ;
 * le serveur ajoute le JWT et relaie vers public-api.meteofrance.fr.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await context.params;
  if (!pathSegments?.length) {
    return NextResponse.json(
      { error: 'Chemin DPObs manquant' },
      { status: 400 }
    );
  }

  const search = request.nextUrl.searchParams.toString();
  const pathAndQuery = search
    ? `${pathSegments.join('/')}?${search}`
    : pathSegments.join('/');

  try {
    const upstream = await fetchDpobs(pathAndQuery);

    if (upstream.status === 503) {
      return new NextResponse(upstream.body, {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const headers = new Headers();
    if (upstream.contentType) {
      headers.set('Content-Type', upstream.contentType);
    } else {
      headers.set('Content-Type', 'application/octet-stream');
    }
    headers.set('Cache-Control', 'no-store');

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error('[meteofrance proxy]', error);
    return NextResponse.json(
      {
        error: 'Erreur proxy Météo-France',
        message: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 502 }
    );
  }
}
