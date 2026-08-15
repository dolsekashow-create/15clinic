import { z } from 'zod';
import { baseEntityShape } from './base.js';

export const notificationSchema = z.object({
  ...baseEntityShape,
  recipientUserId: z.string().nullable().default(null),
  recipientCustomerId: z.string().nullable().default(null),
  title: z.string(),
  body: z.string(),
  type: z.string().default('general'),
  channels: z.array(z.enum(['in_app', 'push', 'email', 'sms', 'whatsapp'])).default(['in_app']),
  entityType: z.string().nullable().default(null),
  entityId: z.string().nullable().default(null),
  readAt: z.string().nullable().default(null),
  sentAt: z.string().nullable().default(null),
  deliveryStatus: z.enum(['pending', 'sent', 'failed']).default('pending'),
  metadata: z.record(z.unknown()).default({}),
});
export type Notification = z.infer<typeof notificationSchema>;

/** Append-only. Firestore rules deny update and delete on this collection. */
export const auditLogSchema = z.object({
  ...baseEntityShape,
  actorId: z.string().nullable(),
  actorName: z.string().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  before: z.record(z.unknown()).nullable().default(null),
  after: z.record(z.unknown()).nullable().default(null),
  changedFields: z.array(z.string()).default([]),
  ip: z.string().nullable().default(null),
  userAgent: z.string().nullable().default(null),
  requestId: z.string().nullable().default(null),
});
export type AuditLog = z.infer<typeof auditLogSchema>;

export const fileSchema = z.object({
  ...baseEntityShape,
  fileName: z.string(),
  storagePath: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  ownerType: z.enum(['customer', 'user', 'doctor', 'appointment', 'visit', 'invoice', 'branch']),
  ownerId: z.string(),
  uploadedBy: z.string().nullable().default(null),
  isPublic: z.boolean().default(false),
  checksum: z.string().nullable().default(null),
});
export type StoredFile = z.infer<typeof fileSchema>;

export const systemSettingSchema = z.object({
  ...baseEntityShape,
  key: z.string(),
  value: z.unknown(),
  scope: z.enum(['global', 'organization', 'branch']).default('organization'),
  description: z.string().nullable().default(null),
});
export type SystemSetting = z.infer<typeof systemSettingSchema>;
