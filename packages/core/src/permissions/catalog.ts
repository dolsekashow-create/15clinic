/**
 * Single source of truth for permission keys.
 * Declared in code (compile-time safety) and seeded into Firestore so the
 * role-editor UI can list them with Arabic labels.
 *
 * Adding a permission = one line here + one seed run. Nothing else.
 */

export interface PermissionDef {
  key: string;
  group: string;
  labelAr: string;
}

const def = (key: string, group: string, labelAr: string): PermissionDef => ({ key, group, labelAr });

export const PERMISSIONS = [
  // ── Users & access control ────────────────────────────────
  def('users.view', 'المستخدمون', 'عرض المستخدمين'),
  def('users.create', 'المستخدمون', 'إضافة مستخدم'),
  def('users.update', 'المستخدمون', 'تعديل مستخدم'),
  def('users.delete', 'المستخدمون', 'حذف مستخدم'),
  def('users.assign_role', 'المستخدمون', 'إسناد الأدوار'),
  def('roles.view', 'الأدوار', 'عرض الأدوار'),
  def('roles.create', 'الأدوار', 'إنشاء دور'),
  def('roles.update', 'الأدوار', 'تعديل دور'),
  def('roles.delete', 'الأدوار', 'حذف دور'),

  // ── Organisation structure ───────────────────────────────
  def('branches.view', 'الفروع', 'عرض الفروع'),
  def('branches.create', 'الفروع', 'إضافة فرع'),
  def('branches.update', 'الفروع', 'تعديل فرع'),
  def('departments.view', 'الأقسام', 'عرض الأقسام'),
  def('departments.create', 'الأقسام', 'إضافة قسم'),
  def('departments.update', 'الأقسام', 'تعديل قسم'),

  // ── Customers ────────────────────────────────────────────
  def('customers.view', 'العملاء', 'عرض العملاء'),
  def('customers.create', 'العملاء', 'إضافة عميل'),
  def('customers.update', 'العملاء', 'تعديل عميل'),
  def('customers.delete', 'العملاء', 'حذف عميل'),
  def('customers.view_all_branches', 'العملاء', 'عرض عملاء كل الفروع'),

  // ── Doctors & services ───────────────────────────────────
  def('doctors.view', 'الأطباء', 'عرض الأطباء'),
  def('doctors.create', 'الأطباء', 'إضافة طبيب'),
  def('doctors.update', 'الأطباء', 'تعديل طبيب'),
  def('services.view', 'الخدمات', 'عرض الخدمات'),
  def('services.create', 'الخدمات', 'إضافة خدمة'),
  def('services.update', 'الخدمات', 'تعديل خدمة'),

  // ── Appointments ─────────────────────────────────────────
  def('appointments.view', 'الحجوزات', 'عرض الحجوزات'),
  def('appointments.view_all_branches', 'الحجوزات', 'عرض حجوزات كل الفروع'),
  def('appointments.create', 'الحجوزات', 'إنشاء حجز'),
  def('appointments.update', 'الحجوزات', 'تعديل حجز'),
  def('appointments.cancel', 'الحجوزات', 'إلغاء حجز'),
  def('appointments.reschedule', 'الحجوزات', 'إعادة جدولة حجز'),

  // ── Customer attendance (check-in / check-out) ───────────
  def('attendance.view', 'الحضور والانصراف', 'عرض سجل الحضور'),
  def('attendance.check_in', 'الحضور والانصراف', 'تسجيل حضور عميل'),
  def('attendance.check_out', 'الحضور والانصراف', 'تسجيل انصراف عميل'),
  def('attendance.update', 'الحضور والانصراف', 'تعديل سجل حضور'),
  def('attendance.override', 'الحضور والانصراف', 'تعديل الأوقات يدويًا'),

  // ── Accounting ───────────────────────────────────────────
  def('accounting.accounts.view', 'المحاسبة', 'عرض شجرة الحسابات'),
  def('accounting.accounts.manage', 'المحاسبة', 'إدارة شجرة الحسابات'),
  def('accounting.journal.view', 'المحاسبة', 'عرض القيود'),
  def('accounting.journal.create', 'المحاسبة', 'إنشاء قيد يدوي'),
  def('accounting.journal.post', 'المحاسبة', 'ترحيل القيود'),
  def('accounting.journal.reverse', 'المحاسبة', 'عكس قيد مُرحَّل'),
  def('accounting.invoices.view', 'المحاسبة', 'عرض الفواتير'),
  def('accounting.invoices.create', 'المحاسبة', 'إصدار فاتورة'),
  def('accounting.invoices.update', 'المحاسبة', 'تعديل فاتورة'),
  def('accounting.invoices.void', 'المحاسبة', 'إلغاء فاتورة'),
  def('accounting.payments.view', 'المحاسبة', 'عرض المدفوعات'),
  def('accounting.payments.create', 'المحاسبة', 'تسجيل دفعة'),
  def('accounting.payments.refund', 'المحاسبة', 'تسجيل مرتجع'),
  def('accounting.cash_sessions.manage', 'المحاسبة', 'فتح وإغلاق الوردية'),
  def('accounting.periods.close', 'المحاسبة', 'إقفال الفترة المحاسبية'),
  def('accounting.reports.view', 'المحاسبة', 'عرض التقارير المالية'),

  // ── Platform ─────────────────────────────────────────────
  def('notifications.view', 'الإشعارات', 'عرض الإشعارات'),
  def('notifications.send', 'الإشعارات', 'إرسال إشعار'),
  def('audit_logs.view', 'سجل العمليات', 'عرض سجل العمليات'),
  def('reports.view', 'التقارير', 'عرض التقارير'),
  def('settings.view', 'الإعدادات', 'عرض الإعدادات'),
  def('settings.update', 'الإعدادات', 'تعديل الإعدادات'),

  // ── Inventory ────────────────────────────────────────────
  def('inventory.view', 'المخازن', 'عرض المخزون'),
  def('inventory.items.manage', 'المخازن', 'إدارة الأصناف'),
  def('inventory.warehouses.manage', 'المخازن', 'إدارة المخازن'),
  def('inventory.receive', 'المخازن', 'استلام بضاعة'),
  def('inventory.issue', 'المخازن', 'صرف من المخزن'),
  def('inventory.transfer', 'المخازن', 'تحويل بين المخازن'),
  def('inventory.transfer.receive', 'المخازن', 'استلام تحويل'),
  def('inventory.adjust', 'المخازن', 'تسوية جرد'),
  def('inventory.reports.view', 'المخازن', 'تقارير المخزون'),
] as const satisfies readonly PermissionDef[];

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

export const PERMISSION_KEYS: readonly string[] = PERMISSIONS.map((p) => p.key);

export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEYS.includes(value);
}
