'use client';

import { useState } from 'react';
import { signIn } from '@/lib/firebase-client';
import { Button, Card } from '@/components/ui/primitives';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      window.location.href = '/dashboard';
    } catch (err) {
      // Deliberately does not say whether the email exists — that would let
      // anyone enumerate staff accounts.
      setError(err instanceof Error ? err.message : 'البريد أو كلمة المرور غير صحيحة');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <Card className="w-full max-w-sm p-7">
        <p className="font-display text-2xl text-ink">تسجيل الدخول</p>
        <p className="mt-1 text-sm text-ink-muted">للموظفين والإدارة فقط.</p>

        <div className="mt-6 space-y-3">
          <label className="block">
            <span className="eyebrow">البريد الإلكتروني</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-edge bg-paper-card px-3 py-2.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="eyebrow">كلمة المرور</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-edge bg-paper-card px-3 py-2.5 text-sm"
            />
          </label>
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded-lg bg-clay-light px-3 py-2 text-sm text-clay">
            {error}
          </p>
        ) : null}

        <div className="mt-5">
          <Button onClick={handleSubmit} disabled={busy || !email || !password}>
            {busy ? 'جاري الدخول…' : 'دخول'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
