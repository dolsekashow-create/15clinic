import { PERMISSION_KEYS } from './catalog';

/**
 * INITIAL roles for development and first login only.
 * These are NOT final business rules — the client has not signed off on
 * who may do what. Roles are fully editable from the UI at runtime.
 */
export interface RoleSeed {
  key: string;
  nameAr: string;
  isSystem: boolean;
  permissions: readonly string[] | 'ALL';
}

export const INITIAL_ROLES: readonly RoleSeed[] = [
  { key: 'super_admin', nameAr: 'مدير النظام', isSystem: true, permissions: 'ALL' },
  { key: 'company_admin', nameAr: 'مدير الشركة', isSystem: true, permissions: PERMISSION_KEYS },
  {
    key: 'branch_manager',
    nameAr: 'مدير فرع',
    isSystem: false,
    permissions: [
      'users.view', 'branches.view', 'departments.view',
      'customers.view', 'customers.create', 'customers.update',
      'doctors.view', 'services.view',
      'appointments.view', 'appointments.create', 'appointments.update',
      'appointments.cancel', 'appointments.reschedule',
      'attendance.view', 'attendance.check_in', 'attendance.check_out', 'attendance.update',
      'accounting.invoices.view', 'accounting.payments.view',
      'accounting.cash_sessions.manage', 'accounting.reports.view',
      'notifications.view', 'audit_logs.view', 'reports.view',
    ],
  },
  {
    key: 'receptionist',
    nameAr: 'موظف استقبال',
    isSystem: false,
    permissions: [
      'customers.view', 'customers.create', 'customers.update',
      'doctors.view', 'services.view',
      'appointments.view', 'appointments.create', 'appointments.update', 'appointments.reschedule',
      'attendance.view', 'attendance.check_in', 'attendance.check_out',
      'accounting.invoices.view', 'accounting.invoices.create',
      'accounting.payments.view', 'accounting.payments.create',
      'notifications.view',
    ],
  },
  {
    key: 'doctor',
    nameAr: 'طبيب',
    isSystem: false,
    permissions: ['customers.view', 'appointments.view', 'attendance.view', 'services.view', 'notifications.view'],
  },
  {
    key: 'accountant',
    nameAr: 'محاسب',
    isSystem: false,
    permissions: [
      'branches.view', 'customers.view', 'services.view',
      'accounting.accounts.view', 'accounting.accounts.manage',
      'accounting.journal.view', 'accounting.journal.create', 'accounting.journal.post',
      'accounting.journal.reverse',
      'accounting.invoices.view', 'accounting.invoices.void',
      'accounting.payments.view', 'accounting.payments.refund',
      'accounting.periods.close', 'accounting.reports.view',
      'reports.view', 'audit_logs.view',
    ],
  },
  {
    key: 'warehouse_manager',
    nameAr: 'مسؤول المخزن',
    isSystem: false,
    // BUSINESS_RULE_PENDING — inventory workflow undefined.
    permissions: ['inventory.view', 'inventory.create', 'inventory.transfer', 'branches.view'],
  },
  { key: 'employee', nameAr: 'موظف', isSystem: false, permissions: ['appointments.view', 'notifications.view'] },
];
