import { NextRequest, NextResponse } from 'next/server';
import { SHARED_AUTH_COOKIE } from '@/lib/sharedAuth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const isHttps =
    request.nextUrl.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https';

  response.cookies.set(SHARED_AUTH_COOKIE, '', {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
