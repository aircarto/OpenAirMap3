'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

type Props = {
  nextPath: string;
};

export default function SharedAuthLoginForm({ nextPath }: Props) {
  const t = useTranslations('pages.login');
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? t('errorGeneric'));
        return;
      }

      router.replace(nextPath || '/');
      router.refresh();
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-xl shadow-slate-950/5"
    >
      <div className="space-y-1 text-left">
        <label
          htmlFor="shared-auth-username"
          className="block text-sm font-medium text-slate-700"
        >
          {t('username')}
        </label>
        <input
          id="shared-auth-username"
          name="username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#4271B3] focus:ring-2 focus:ring-[#4271B3]/30"
        />
      </div>

      <div className="space-y-1 text-left">
        <label
          htmlFor="shared-auth-password"
          className="block text-sm font-medium text-slate-700"
        >
          {t('password')}
        </label>
        <input
          id="shared-auth-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#4271B3] focus:ring-2 focus:ring-[#4271B3]/30"
        />
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[#4271B3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#325A96] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
