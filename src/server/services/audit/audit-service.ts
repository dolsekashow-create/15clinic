import type { AccessContext } from '@/server/core';
import { AuditLogRepository } from '@/server/data';
import { logger } from '@/server/infra';

/**
 * Audit is emitted from the service layer, not the repository: only the service
 * knows the INTENT of a write ("cancelled appointment" vs "updated record").
 *
 * Two hard rules:
 *  - sensitive fields never reach the log
 *  - a failed audit write never fails the business operation, but it does raise
 *    an error-level log so the gap is visible
 */

const SENSITIVE_FIELDS = new Set([
  'password', 'nationalId', 'token', 'idToken', 'sessionCookie', 'privateKey', 'secret',
]);

function redact(value: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!value) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE_FIELDS.has(k) ? '[redacted]' : v;
  }
  return out;
}

function diffFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string[] {
  if (!before || !after) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
}

export interface AuditInput {
  action: string;
  entityType: string;
  entityId: string | null;
  branchId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  actorName?: string | null;
}

export class AuditService {
  private readonly repo = new AuditLogRepository();

  async record(ctx: AccessContext, input: AuditInput): Promise<void> {
    try {
      const before = redact(input.before ?? null);
      const after = redact(input.after ?? null);

      await this.repo.create(ctx, {
        branchId: input.branchId ?? null,
        actorId: ctx.userId,
        actorName: input.actorName ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        before,
        after,
        changedFields: diffFields(before, after),
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        requestId: ctx.requestId,
      } as never);
    } catch (err) {
      logger.error('audit_write_failed', {
        requestId: ctx.requestId,
        action: input.action,
        error: String(err),
      });
    }
  }
}

export const auditService = new AuditService();
