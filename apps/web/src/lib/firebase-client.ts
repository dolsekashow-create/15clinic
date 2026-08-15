'use client';

import { getApps, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';

/**
 * Browser Firebase, used ONLY to obtain an id token at sign-in.
 * The token is immediately exchanged for an httpOnly session cookie and is
 * never stored — see src/app/api/v1/auth/session/route.ts.
 *
 * These NEXT_PUBLIC_ values are not secrets; Firebase config is public by
 * design. The protection is the security rules plus server-side authorisation.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

export function clientAuth() {
  const app = getApps()[0] ?? initializeApp(config);
  return getAuth(app);
}

export async function signIn(email: string, password: string): Promise<void> {
  const auth = clientAuth();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await credential.user.getIdToken();

  const res = await fetch('/api/v1/auth/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const payload = (await res.json()) as { error?: { message?: string } };
    throw new Error(payload.error?.message ?? 'تعذر تسجيل الدخول');
  }

  // The browser session is no longer needed once the cookie exists.
  await signOut(auth);
}

export async function signOutEverywhere(): Promise<void> {
  await fetch('/api/v1/auth/session', { method: 'DELETE' });
  window.location.href = '/login';
}
