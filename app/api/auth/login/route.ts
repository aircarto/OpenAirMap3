import { NextRequest, NextResponse } from 'next/server';
import {
  SHARED_AUTH_COOKIE,
  SHARED_AUTH_MAX_AGE_SEC,
  createSharedAuthToken,
  credentialsMatch,
  getSharedAuthCredentials,
  isSharedAuthConfigured,
  isSharedAuthEnabled,
} from '@/lib/sharedAuth';

export const runtime = 'nodejs';

type LoginBody = {
  username?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  if (!isSharedAuthEnabled()) {
    return NextResponse.json(
      { error: 'Auth partagée désactivée' },
      { status: 404 }
    );
  }

  if (!isSharedAuthConfigured()) {
    return NextResponse.json(
      { error: 'Auth partagée mal configurée (USER / PASSWORD / SECRET)' },
      { status: 503 }
    );
  }

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const expected = getSharedAuthCredentials();

  if (!credentialsMatch(username, password, expected)) {
    return NextResponse.json(
      { error: 'Identifiants incorrects' },
      { status: 401 }
    );
  }

  const token = await createSharedAuthToken(expected.secret);
  const response = NextResponse.json({ ok: true });
  const isHttps =
    request.nextUrl.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https';

  response.cookies.set(SHARED_AUTH_COOKIE, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    maxAge: SHARED_AUTH_MAX_AGE_SEC,
  });

  return response;
}
