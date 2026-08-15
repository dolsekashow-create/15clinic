import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

/**
 * Server-only Firebase Admin bootstrap.
 *
 * Credentials come from environment variables, never from a committed JSON file.
 * Importing this module from client code is a build error by design: it lives in
 * a package the presentation layer is not allowed to depend on.
 */

let app: App | undefined;

function readCredentials() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Stored with literal \n sequences in the env var; restored here.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin credentials missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.',
    );
  }
  return { projectId, clientEmail, privateKey };
}

export function getAdminApp(): App {
  if (app) return app;
  const existing = getApps();
  if (existing.length > 0 && existing[0]) {
    app = existing[0];
    return app;
  }
  const creds = readCredentials();
  app = initializeApp({
    credential: cert(creds),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
  return app;
}

let firestore: Firestore | undefined;

export function getDb(): Firestore {
  if (!firestore) {
    firestore = getFirestore(getAdminApp());
    firestore.settings({ ignoreUndefinedProperties: true });
  }
  return firestore;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getBucket() {
  return getStorage(getAdminApp()).bucket();
}
