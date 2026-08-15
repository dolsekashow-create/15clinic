/**
 * Development seed.
 *
 * Creates one organisation, three branches, the permission catalogue, the
 * initial roles, a super-admin login, the chart of accounts, and a small set of
 * demo doctors / services / customers.
 *
 * Every demo record carries `isDemo: true` so production data can never be
 * confused with it. The script refuses to run against production.
 */
import { INITIAL_ROLES, PERMISSIONS } from '@clinic/core';
import { COLLECTIONS } from '@clinic/data';
import { DEFAULT_CHART_OF_ACCOUNTS, ACCOUNT_MAP_SETTING_KEY } from '@clinic/services';
import { getAdminAuth, getDb } from '@clinic/infra';

if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') {
  throw new Error('Refusing to seed a production environment.');
}

const db = getDb();
const auth = getAdminAuth();
const now = () => new Date().toISOString();

function base(organizationId: string, branchId: string | null = null, demo = true) {
  return {
    organizationId,
    branchId,
    createdAt: now(),
    updatedAt: now(),
    createdBy: 'seed',
    updatedBy: null,
    isDeleted: false,
    deletedAt: null,
    isDemo: demo,
  };
}

async function main() {
  const orgRef = db.collection(COLLECTIONS.organizations).doc('org_demo');
  const organizationId = orgRef.id;

  await orgRef.set({
    ...base(organizationId, null, true),
    name: process.env.SEED_ORGANIZATION_NAME ?? 'شركة العيادات (بيانات تجريبية)',
    slug: 'demo-clinics',
    timezone: 'Africa/Cairo',
    currency: 'EGP',
    status: 'active',
    settings: {},
  });
  console.log('✓ organization');

  // ── Permissions ───────────────────────────────────────────
  let batch = db.batch();
  for (const p of PERMISSIONS) {
    const [resource = '', action = ''] = p.key.split('.');
    batch.set(db.collection(COLLECTIONS.permissions).doc(p.key), {
      ...base(organizationId, null, false),
      key: p.key,
      resource,
      action,
      group: p.group,
      labelAr: p.labelAr,
    });
  }
  await batch.commit();
  console.log(`✓ ${PERMISSIONS.length} permissions`);

  // ── Roles + role_permissions ─────────────────────────────
  batch = db.batch();
  for (const role of INITIAL_ROLES) {
    const roleId = `role_${role.key}`;
    batch.set(db.collection(COLLECTIONS.roles).doc(roleId), {
      ...base(organizationId, null, false),
      key: role.key,
      nameAr: role.nameAr,
      isSystem: role.isSystem,
      level: 100,
    });
    const keys = role.permissions === 'ALL' ? PERMISSIONS.map((p) => p.key) : role.permissions;
    for (const permissionKey of keys) {
      batch.set(db.collection(COLLECTIONS.rolePermissions).doc(`${roleId}__${permissionKey}`), {
        ...base(organizationId, null, false),
        roleId,
        permissionKey,
      });
    }
  }
  await batch.commit();
  console.log(`✓ ${INITIAL_ROLES.length} roles`);

  // ── Branches ─────────────────────────────────────────────
  const branches = [
    { id: 'branch_maadi', name: 'فرع المعادي', code: 'MAA' },
    { id: 'branch_nasr', name: 'فرع مدينة نصر', code: 'NSR' },
    { id: 'branch_giza', name: 'فرع الجيزة', code: 'GIZ' },
  ];
  batch = db.batch();
  for (const b of branches) {
    batch.set(db.collection(COLLECTIONS.branches).doc(b.id), {
      ...base(organizationId, b.id),
      name: b.name,
      code: b.code,
      timezone: 'Africa/Cairo',
      status: 'active',
      managerId: null,
      workingHours: null,
      location: null,
    });
  }
  await batch.commit();
  console.log('✓ 3 branches');

  // ── Chart of accounts ────────────────────────────────────
  const idByCode = new Map<string, string>();
  const systemAccounts: Record<string, string> = {};
  batch = db.batch();
  for (const a of DEFAULT_CHART_OF_ACCOUNTS) {
    const id = `acc_${a.code}`;
    idByCode.set(a.code, id);
    const parentId = a.parentCode ? idByCode.get(a.parentCode) ?? null : null;
    batch.set(db.collection(COLLECTIONS.accounts).doc(id), {
      ...base(organizationId, null, false),
      code: a.code,
      name: a.name,
      type: a.type,
      normalBalance: a.type === 'asset' || a.type === 'expense' ? 'debit' : 'credit',
      parentId,
      isGroup: a.isGroup ?? false,
      path: parentId ? [parentId] : [],
      level: parentId ? 1 : 0,
      currency: 'EGP',
      isSystem: Boolean(a.systemKey),
      status: 'active',
      description: null,
    });
    if (a.systemKey) systemAccounts[a.systemKey] = id;
  }
  await batch.commit();
  console.log(`✓ ${DEFAULT_CHART_OF_ACCOUNTS.length} accounts`);

  // ── Settings ─────────────────────────────────────────────
  await db.collection(COLLECTIONS.systemSettings).doc('setting_system_accounts').set({
    ...base(organizationId, null, false),
    key: ACCOUNT_MAP_SETTING_KEY,
    value: systemAccounts,
    scope: 'organization',
    description: 'ربط الحسابات المستخدمة في القيود الآلية',
  });

  await db.collection(COLLECTIONS.systemSettings).doc('setting_appointment_statuses').set({
    ...base(organizationId, null, false),
    key: 'appointments.statuses',
    value: ['scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'],
    scope: 'organization',
    description: 'حالات الحجز — قابلة للتعديل من الإعدادات',
  });
  console.log('✓ settings');

  // ── Super admin ──────────────────────────────────────────
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (email && password) {
    let uid: string;
    try {
      uid = (await auth.getUserByEmail(email)).uid;
    } catch {
      uid = (await auth.createUser({ email, password, displayName: 'مدير النظام' })).uid;
    }
    await auth.setCustomUserClaims(uid, { organizationId, isSuperAdmin: true });

    const userId = 'user_super_admin';
    await db.collection(COLLECTIONS.users).doc(userId).set({
      ...base(organizationId, null, false),
      authUid: uid,
      fullName: 'مدير النظام',
      email,
      phone: null,
      status: 'active',
      tokenVersion: 0,
      lastLoginAt: null,
      locale: 'ar',
      primaryBranchId: null,
      jobTitle: 'Super Admin',
      avatarFileId: null,
    });
    await db.collection(COLLECTIONS.userRoles).doc(`${userId}__role_super_admin__org`).set({
      ...base(organizationId, null, false),
      userId,
      roleId: 'role_super_admin',
      assignedBy: 'seed',
      assignedAt: now(),
    });
    console.log(`✓ super admin: ${email}`);
  } else {
    console.log('… skipped super admin (set SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD)');
  }

  // ── Demo clinical data ───────────────────────────────────
  batch = db.batch();
  const services = [
    { id: 'svc_consult', name: 'كشف', code: 'S-001', price: 30000, duration: 20 },
    { id: 'svc_followup', name: 'استشارة متابعة', code: 'S-002', price: 15000, duration: 15 },
    { id: 'svc_xray', name: 'أشعة', code: 'S-003', price: 25000, duration: 30 },
  ];
  for (const s of services) {
    batch.set(db.collection(COLLECTIONS.services).doc(s.id), {
      ...base(organizationId, null),
      name: s.name,
      code: s.code,
      description: null,
      categoryId: null,
      durationMinutes: s.duration,
      branchIds: branches.map((b) => b.id),
      status: 'active',
      // Demo pricing only — real pricing is BUSINESS_RULE_PENDING.
      defaultPriceMinor: s.price,
      defaultTaxRateId: null,
      revenueAccountId: systemAccounts.service_revenue ?? null,
    });
  }

  const doctors = [
    { id: 'doc_1', name: 'د. أحمد سمير', spec: 'باطنة' },
    { id: 'doc_2', name: 'د. منى عبد الله', spec: 'جلدية' },
    { id: 'doc_3', name: 'د. كريم فؤاد', spec: 'أسنان' },
  ];
  for (const [i, d] of doctors.entries()) {
    batch.set(db.collection(COLLECTIONS.doctors).doc(d.id), {
      ...base(organizationId, null),
      userId: null,
      fullName: d.name,
      specialization: d.spec,
      licenseNumber: null,
      phone: null,
      email: null,
      branchIds: [branches[i % branches.length]!.id],
      departmentId: null,
      bio: null,
      avatarFileId: null,
      status: 'active',
    });
  }

  for (let i = 1; i <= 10; i++) {
    const branch = branches[i % branches.length]!;
    batch.set(db.collection(COLLECTIONS.customers).doc(`cust_demo_${i}`), {
      ...base(organizationId, null),
      code: `C-${String(i).padStart(4, '0')}`,
      fullName: `عميل تجريبي ${i}`,
      phone: `+2010000000${String(i).padStart(2, '0')}`,
      altPhone: null,
      email: null,
      gender: 'unspecified',
      birthDate: null,
      nationalId: null,
      address: null,
      primaryBranchId: branch.id,
      source: 'walk_in',
      status: 'active',
      tags: [],
      notes: null,
      mobileAuthUid: null,
      searchTokens: [`عميل`, `تجريبي`, String(i)],
    });
  }
  await batch.commit();
  console.log('✓ demo services, doctors, customers');

  console.log('\nSeed complete. All demo records carry isDemo: true.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
