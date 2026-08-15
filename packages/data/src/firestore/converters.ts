import { Timestamp } from 'firebase-admin/firestore';

/**
 * The data layer is the only place that knows about Firestore Timestamps.
 * Everything above it works with ISO-8601 strings, which serialise cleanly
 * to JSON for both the web app and the mobile app.
 */

export function toIso(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toIso);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = toIso(v);
    return out;
  }
  if (value instanceof Date) return value.toISOString();
  return value;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function toFirestore(value: unknown): unknown {
  if (typeof value === 'string' && ISO_RE.test(value)) return Timestamp.fromDate(new Date(value));
  if (Array.isArray(value)) return value.map(toFirestore);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = toFirestore(v);
    return out;
  }
  return value;
}

export function fromDoc<T>(id: string, data: Record<string, unknown>): T {
  return { id, ...(toIso(data) as Record<string, unknown>) } as T;
}
