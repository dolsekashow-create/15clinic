import {
  AppError, ErrorCode, canAccessBranch, hasPermission,
  type AccessContext, type User,
} from '@/server/core';
import {
  COLLECTIONS, RoleRepository, UserBranchRepository, UserRepository, UserRoleRepository,
} from '@/server/data';
import { getAdminAuth, getDb } from '@/server/infra';
import { invalidateUserAccess } from '@/server/auth';
import { auditService } from '../audit/audit-service';

/**
 * ── User administration ────────────────────────────────────────────────
 *
 * Creating a staff member touches two systems that can drift apart: Firebase
 * Auth (the identity) and our `users` collection (the profile, roles and
 * branches). The order below is deliberate — the auth account is created
 * first, and if the Firestore write then fails the auth account is deleted
 * again. An orphaned login that maps to no user record would be an account
 * nobody can see in the UI but that still passes authentication.
 *
 * Privilege escalation is blocked explicitly: a manager cannot grant a
 * permission they do not themselves hold, and cannot assign a user to a branch
 * outside their own scope. Without those two checks, "add user" quietly
 * becomes "become super admin".
 */

export interface CreateUserInput {
  fullName: string;
  email: string;
  password: string;
  phone?: string | null;
  jobTitle?: string | null;
  /** Role assignments: `branchId: null` grants the role across the org. */
  roles: Array<{ roleId: string; branchId: string | null }>;
  branchIds: string[];
  primaryBranchId?: string | null;
}

export class UserService {
  private readonly users = new UserRepository();
  private readonly roles = new RoleRepository();
  private readonly userRoles = new UserRoleRepository();
  private readonly userBranches = new UserBranchRepository();

  /** A user may never hand out access they do not hold themselves. */
  private async assertCanGrant(
    ctx: AccessContext,
    assignments: Array<{ roleId: string; branchId: string | null }>,
    branchIds: string[],
  ): Promise<void> {
    if (ctx.isSuperAdmin) return;

    for (const branchId of branchIds) {
      if (!canAccessBranch(ctx, branchId)) throw AppError.branchForbidden(branchId);
    }

    for (const assignment of assignments) {
      if (assignment.branchId === null && ctx.scope === 'BRANCH') {
        // A branch-scoped manager cannot create org-wide access.
        throw AppError.forbidden({ reason: 'cannot grant organization-wide roles' });
      }
      if (assignment.branchId && !canAccessBranch(ctx, assignment.branchId)) {
        throw AppError.branchForbidden(assignment.branchId);
      }

      const role = await this.roles.requireById(ctx, assignment.roleId);
      if (role.key === 'super_admin') {
        throw AppError.forbidden({ reason: 'super_admin can only be granted by a super admin' });
      }

      // The granter must hold every permission the granted role carries.
      const permissions = await this.permissionsOfRole(ctx, assignment.roleId);
      const missing = permissions.filter((p) => !hasPermission(ctx, p));
      if (missing.length > 0) {
        throw AppError.forbidden({ reason: 'cannot grant permissions you do not hold', missing });
      }
    }
  }

  private async permissionsOfRole(ctx: AccessContext, roleId: string): Promise<string[]> {
    const snap = await getDb()
      .collection(COLLECTIONS.rolePermissions)
      .where('organizationId', '==', ctx.organizationId)
      .where('roleId', '==', roleId)
      .get();
    return snap.docs.map((d) => d.get('permissionKey') as string);
  }

  async createUser(ctx: AccessContext, input: CreateUserInput): Promise<User> {
    await this.assertCanGrant(ctx, input.roles, input.branchIds);

    const existing = await this.users.list(ctx, {
      filters: [{ field: 'email', op: '==', value: input.email.toLowerCase() }],
      limit: 1,
    });
    if (existing.items.length > 0) {
      throw AppError.conflict(ErrorCode.CONFLICT, { reason: 'email already registered' });
    }

    const auth = getAdminAuth();
    const authUser = await auth.createUser({
      email: input.email.toLowerCase(),
      password: input.password,
      displayName: input.fullName,
    });

    try {
      await auth.setCustomUserClaims(authUser.uid, {
        organizationId: ctx.organizationId,
        isSuperAdmin: false,
      });

      const user = await this.users.create(ctx, {
        branchId: null,
        authUid: authUser.uid,
        fullName: input.fullName,
        email: input.email.toLowerCase(),
        phone: input.phone ?? null,
        avatarFileId: null,
        jobTitle: input.jobTitle ?? null,
        primaryBranchId: input.primaryBranchId ?? input.branchIds[0] ?? null,
        status: 'active',
        tokenVersion: 0,
        lastLoginAt: null,
        locale: 'ar',
      } as never);

      await this.syncAccess(ctx, user.id, input.roles, input.branchIds);

      await auditService.record(ctx, {
        action: 'users.create',
        entityType: 'user',
        entityId: user.id,
        after: { email: user.email, roles: input.roles, branchIds: input.branchIds },
      });

      return user;
    } catch (err) {
      // Roll the identity back so we never leave a login with no user record.
      await auth.deleteUser(authUser.uid).catch(() => undefined);
      throw err;
    }
  }

  /** Replaces a user's roles and branches wholesale. */
  async syncAccess(
    ctx: AccessContext,
    userId: string,
    roles: Array<{ roleId: string; branchId: string | null }>,
    branchIds: string[],
  ): Promise<void> {
    await this.assertCanGrant(ctx, roles, branchIds);

    const db = getDb();
    const [oldRoles, oldBranches] = await Promise.all([
      db.collection(COLLECTIONS.userRoles)
        .where('organizationId', '==', ctx.organizationId)
        .where('userId', '==', userId).get(),
      db.collection(COLLECTIONS.userBranches)
        .where('organizationId', '==', ctx.organizationId)
        .where('userId', '==', userId).get(),
    ]);

    const batch = db.batch();
    for (const doc of [...oldRoles.docs, ...oldBranches.docs]) batch.delete(doc.ref);
    await batch.commit();

    for (const assignment of roles) {
      await this.userRoles.create(ctx, {
        branchId: assignment.branchId,
        userId,
        roleId: assignment.roleId,
        assignedBy: ctx.userId,
        assignedAt: new Date().toISOString(),
      } as never);
    }

    for (const [index, branchId] of branchIds.entries()) {
      await this.userBranches.create(ctx, {
        branchId,
        userId,
        isPrimary: index === 0,
        assignedAt: new Date().toISOString(),
      } as never);
    }

    // The permission cache is keyed by tokenVersion, so bump it to make the
    // change take effect on the very next request rather than in 30 seconds.
    await this.bumpTokenVersion(ctx, userId);

    await auditService.record(ctx, {
      action: 'users.assign_role',
      entityType: 'user',
      entityId: userId,
      after: { roles, branchIds },
    });
  }

  /**
   * Suspends a user immediately: the account status is flipped AND every
   * existing session is revoked. Flipping the status alone would leave an
   * already-signed-in employee working until their cookie expired.
   */
  async setStatus(ctx: AccessContext, userId: string, status: User['status'], reason?: string): Promise<void> {
    if (!hasPermission(ctx, 'users.update')) throw AppError.forbidden({ required: 'users.update' });
    if (userId === ctx.userId && status !== 'active') {
      throw AppError.validation({ reason: 'you cannot suspend your own account' });
    }

    const user = await this.users.requireById(ctx, userId);
    await this.users.update(ctx, userId, { status } as Partial<User>);

    if (status !== 'active') {
      await getAdminAuth().revokeRefreshTokens(user.authUid);
      await getAdminAuth().updateUser(user.authUid, { disabled: true });
    } else {
      await getAdminAuth().updateUser(user.authUid, { disabled: false });
    }

    await this.bumpTokenVersion(ctx, userId);

    await auditService.record(ctx, {
      action: `users.${status}`,
      entityType: 'user',
      entityId: userId,
      before: { status: user.status },
      after: { status, reason: reason ?? null },
    });
  }

  private async bumpTokenVersion(ctx: AccessContext, userId: string): Promise<void> {
    const user = await this.users.requireById(ctx, userId);
    await this.users.update(ctx, userId, {
      tokenVersion: (user.tokenVersion ?? 0) + 1,
    } as Partial<User>);
    invalidateUserAccess(userId);
  }

  /** Roles and branches expanded, for the users table. */
  async listWithAccess(ctx: AccessContext) {
    const page = await this.users.list(ctx, { orderBy: { field: 'fullName' }, limit: 100 });
    const db = getDb();

    const [roleAssignments, branchAssignments, roles] = await Promise.all([
      db.collection(COLLECTIONS.userRoles).where('organizationId', '==', ctx.organizationId).get(),
      db.collection(COLLECTIONS.userBranches).where('organizationId', '==', ctx.organizationId).get(),
      db.collection(COLLECTIONS.roles).where('organizationId', '==', ctx.organizationId).get(),
    ]);

    const roleNames = new Map(roles.docs.map((d) => [d.id, d.get('nameAr') as string]));

    return page.items.map((user) => ({
      ...user,
      roles: roleAssignments.docs
        .filter((d) => d.get('userId') === user.id)
        .map((d) => ({
          roleId: d.get('roleId') as string,
          name: roleNames.get(d.get('roleId') as string) ?? '—',
          branchId: (d.get('branchId') as string | null) ?? null,
        })),
      branchIds: branchAssignments.docs
        .filter((d) => d.get('userId') === user.id)
        .map((d) => d.get('branchId') as string),
    }));
  }
}

export const userService = new UserService();
