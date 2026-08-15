import { getDb } from '@clinic/infra';
import { COLLECTIONS } from './collections.js';

/**
 * Atomic, gap-free-ish counters for human-facing numbers:
 * invoice numbers, payment numbers, appointment codes, daily queue numbers.
 *
 * Firestore transactions guarantee no two receptionists get the same number,
 * which a `count()+1` read would not.
 */
export async function nextSequence(
  organizationId: string,
  key: string,
  padTo = 5,
): Promise<{ value: number; formatted: string }> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.sequences).doc(`${organizationId}__${key}`);

  const value = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? ((snap.data()?.value as number | undefined) ?? 0) : 0;
    const next = current + 1;
    tx.set(ref, { organizationId, key, value: next, updatedAt: new Date().toISOString() }, { merge: true });
    return next;
  });

  return { value, formatted: String(value).padStart(padTo, '0') };
}
