/**
 * The most important tests in the system.
 *
 * These run against the Firestore emulator, not a real project. They exist
 * because branch isolation is the one bug class that would be catastrophic and
 * silent: nobody notices data leaking across branches until an auditor does.
 *
 * Run with:  firebase emulators:exec --only firestore "pnpm vitest run"
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { AccessContext } from '@clinic/core';
import { AppointmentRepository, VisitRepository } from '@clinic/data';

const ORG = 'org_test';

function ctxFor(userId: string, branchIds: string[]): AccessContext {
  return {
    userId,
    organizationId: ORG,
    isSuperAdmin: false,
    roleIds: ['role_receptionist'],
    permissions: new Set(['appointments.view', 'attendance.view']),
    branchIds,
    scope: 'BRANCH',
    requestId: `test_${userId}`,
  };
}

const userA = ctxFor('user_a', ['branch_a']);
const userB = ctxFor('user_b', ['branch_b']);

describe('multi-branch isolation', () => {
  const appointments = new AppointmentRepository();
  const visits = new VisitRepository();
  let appointmentInB: string;

  beforeAll(async () => {
    const created = await appointments.create(userB, {
      branchId: 'branch_b',
      code: 'A-1',
      customerId: 'cust_1',
      scheduledStart: new Date().toISOString(),
      scheduledEnd: new Date().toISOString(),
      status: 'scheduled',
    } as never);
    appointmentInB = created.id;
  });

  it('does not list another branch records', async () => {
    const page = await appointments.list(userA, {});
    expect(page.items.every((a) => a.branchId === 'branch_a')).toBe(true);
  });

  it('refuses a direct id lookup across branches', async () => {
    await expect(appointments.findById(userA, appointmentInB)).rejects.toThrow(
      /FORBIDDEN_BRANCH_ACCESS/,
    );
  });

  it('refuses to write into a branch the user does not belong to', async () => {
    await expect(
      visits.create(userA, { branchId: 'branch_b', customerId: 'cust_1' } as never),
    ).rejects.toThrow(/FORBIDDEN_BRANCH_ACCESS/);
  });

  it('ignores an organizationId supplied by the caller', async () => {
    await expect(
      appointments.list(userA, {
        filters: [{ field: 'organizationId', op: '==', value: 'org_other' }],
      }),
    ).rejects.toThrow();
  });

  it('a user with no branches sees nothing', async () => {
    const orphan = ctxFor('user_orphan', []);
    const page = await appointments.list(orphan, {});
    expect(page.items).toHaveLength(0);
  });
});
