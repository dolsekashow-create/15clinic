import { z } from 'zod';
import { AppError, PERMISSIONS, isPermissionKey } from '@clinic/core';
import { withAuth } from '@clinic/auth';
import { COLLECTIONS, RoleRepository } from '@clinic/data';
import { getDb } from '@clinic/infra';
import { auditService } from '@clinic/services';

export const runtime = 'nodejs';

const roles = new RoleRepository();

/** Roles plus the permission catalogue, so the matrix screen needs one request. */
export const GET = withAuth(
  async (_req, ctx) => {
    const page = await roles.list(ctx, { limit: 100 });
    const grants = await getDb()
      .collection(COLLECTIONS.rolePermissions)
      .where('organizationId', '==', ctx.organizationId)
      .get();

    return Response.json({
      data: {
        catalog: PERMISSIONS,
        roles: page.items.map((role) => ({
          ...role,
          permissions: grants.docs
            .filter((d) => d.get('roleId') === role.id)
            .map((d) => d.get('permissionKey') as string),
        })),
      },
    });
  },
  { permission: 'roles.view' },
);

const updateSchema = z.object({
  roleId: z.string().min(1),
  permissions: z.array(z.string()),
});

export const PUT = withAuth(
  async (req, ctx) => {
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) throw AppError.validation(parsed.error.flatten());

    const unknown = parsed.data.permissions.filter((p) => !isPermissionKey(p));
    if (unknown.length > 0) throw AppError.validation({ reason: 'unknown permissions', unknown });

    const role = await roles.requireById(ctx, parsed.data.roleId);
    if (role.key === 'super_admin' && !ctx.isSuperAdmin) {
      throw AppError.forbidden({ reason: 'super_admin role is not editable' });
    }

    // Nobody may grant a permission they do not hold themselves — otherwise
    // "edit role" is a one-click privilege escalation.
    if (!ctx.isSuperAdmin) {
      const escalation = parsed.data.permissions.filter((p) => !ctx.permissions.has(p));
      if (escalation.length > 0) {
        throw AppError.forbidden({ reason: 'cannot grant permissions you do not hold', escalation });
      }
    }

    const db = getDb();
    const existing = await db
      .collection(COLLECTIONS.rolePermissions)
      .where('organizationId', '==', ctx.organizationId)
      .where('roleId', '==', role.id)
      .get();

    const batch = db.batch();
    for (const doc of existing.docs) batch.delete(doc.ref);
    const now = new Date().toISOString();
    for (const permissionKey of parsed.data.permissions) {
      batch.set(db.collection(COLLECTIONS.rolePermissions).doc(`${role.id}__${permissionKey}`), {
        organizationId: ctx.organizationId,
        branchId: null,
        roleId: role.id,
        permissionKey,
        createdAt: now,
        updatedAt: now,
        createdBy: ctx.userId,
        updatedBy: null,
        isDeleted: false,
        deletedAt: null,
      });
    }
    await batch.commit();

    await auditService.record(ctx, {
      action: 'roles.update_permissions',
      entityType: 'role',
      entityId: role.id,
      before: { permissions: existing.docs.map((d) => d.get('permissionKey')) },
      after: { permissions: parsed.data.permissions },
    });

    return Response.json({ data: { ok: true } });
  },
  { permission: 'roles.update' },
);
