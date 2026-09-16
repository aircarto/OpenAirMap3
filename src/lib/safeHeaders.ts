import { headers } from 'next/headers';

/**
 * Enveloppe sûre autour de headers().
 */
export const safeHeaders = async (): Promise<Headers | null> => {
  try {
    const h = await headers();
    if (!h || typeof h.get !== 'function') return null;
    return h;
  } catch (err) {
    console.error('[safeHeaders]', err);
    return null;
  }
};
