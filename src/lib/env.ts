/**
 * Lecture d'environnement compatible Vite (tests) et Next.
 * Les flags client utilisent NEXT_PUBLIC_* ; NOINDEX reste serveur.
 */
export const readEnv = (key: string): string | undefined => {
  const viteKey = key.startsWith('NEXT_PUBLIC_')
    ? `VITE_${key.slice('NEXT_PUBLIC_'.length)}`
    : key.startsWith('VITE_')
      ? key
      : undefined;
  const nextPublicFromVite = key.startsWith('VITE_')
    ? `NEXT_PUBLIC_${key.slice('VITE_'.length)}`
    : undefined;

  if (typeof process !== 'undefined' && process.env) {
    const fromProcess =
      process.env[key] ??
      (nextPublicFromVite ? process.env[nextPublicFromVite] : undefined) ??
      (viteKey ? process.env[viteKey] : undefined);
    if (fromProcess !== undefined && fromProcess !== null) {
      return fromProcess;
    }
  }

  return undefined;
};

export const isDevRuntime = (): boolean =>
  typeof process !== 'undefined'
    ? process.env.NODE_ENV !== 'production'
    : false;

export const isNoIndexEnabled = (): boolean => {
  const raw = readEnv('NOINDEX') ?? readEnv('NEXT_PUBLIC_NOINDEX');
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return ['true', '1', 'on', 'yes', 'enabled'].includes(normalized);
};
