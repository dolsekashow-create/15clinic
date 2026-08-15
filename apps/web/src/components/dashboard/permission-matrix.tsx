'use client';

import { Fragment, useState } from 'react';
import { Button, Card } from '@/components/ui/primitives';

/**
 * Permission editor.
 *
 * Permissions are grouped by the area of work they belong to, because an owner
 * thinks in "who can touch the money" rather than in individual keys. The keys
 * shown come from the catalogue in packages/core; this component only decides
 * which ones a role holds.
 *
 * Toggling here is cosmetic until saved — and even after saving, the check that
 * matters happens on the server on every request.
 */

const ROLES = ['مدير فرع', 'موظف استقبال', 'طبيب', 'محاسب', 'مسؤول المخزن'];

const GROUPS: Array<{ group: string; permissions: Array<{ key: string; label: string }> }> = [
  {
    group: 'العملاء والحجوزات',
    permissions: [
      { key: 'customers.view', label: 'عرض العملاء' },
      { key: 'customers.create', label: 'إضافة عميل' },
      { key: 'appointments.create', label: 'إنشاء حجز' },
      { key: 'appointments.cancel', label: 'إلغاء حجز' },
    ],
  },
  {
    group: 'الحضور والانصراف',
    permissions: [
      { key: 'attendance.check_in', label: 'تسجيل حضور' },
      { key: 'attendance.check_out', label: 'تسجيل انصراف' },
      { key: 'attendance.override', label: 'تعديل الأوقات يدويًا' },
    ],
  },
  {
    group: 'المحاسبة',
    permissions: [
      { key: 'accounting.invoices.create', label: 'إصدار فاتورة' },
      { key: 'accounting.payments.create', label: 'تسجيل دفعة' },
      { key: 'accounting.journal.post', label: 'ترحيل القيود' },
      { key: 'accounting.periods.close', label: 'إقفال الفترة' },
    ],
  },
  {
    group: 'المخازن',
    permissions: [
      { key: 'inventory.receive', label: 'استلام بضاعة' },
      { key: 'inventory.transfer', label: 'تحويل بين المخازن' },
      { key: 'inventory.adjust', label: 'تسوية جرد' },
    ],
  },
];

/** Demo starting state; the real one loads from the API. */
const INITIAL: Record<string, boolean> = {
  'موظف استقبال:customers.view': true,
  'موظف استقبال:customers.create': true,
  'موظف استقبال:appointments.create': true,
  'موظف استقبال:attendance.check_in': true,
  'موظف استقبال:attendance.check_out': true,
  'موظف استقبال:accounting.invoices.create': true,
  'محاسب:accounting.journal.post': true,
  'محاسب:accounting.periods.close': true,
  'مسؤول المخزن:inventory.receive': true,
  'مسؤول المخزن:inventory.transfer': true,
};

export function PermissionMatrix() {
  const [granted, setGranted] = useState<Record<string, boolean>>(INITIAL);
  const [dirty, setDirty] = useState(false);

  function toggle(role: string, key: string) {
    setGranted((prev) => ({ ...prev, [`${role}:${key}`]: !prev[`${role}:${key}`] }));
    setDirty(true);
  }

  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-paper-sunk">
          <tr>
            <th className="px-4 py-3 text-start font-medium text-ink-muted">الصلاحية</th>
            {ROLES.map((role) => (
              <th key={role} className="px-3 py-3 text-center font-medium text-ink-muted">
                {role}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-edge">
          {GROUPS.map((group) => (
            <Fragment key={group.group}>
              <tr className="bg-paper">
                <td colSpan={ROLES.length + 1} className="px-4 py-2">
                  <span className="eyebrow">{group.group}</span>
                </td>
              </tr>
              {group.permissions.map((permission) => (
                <tr key={permission.key}>
                  <td className="px-4 py-2.5">
                    <span className="text-ink">{permission.label}</span>
                    <span className="ms-2 font-mono text-xs text-ink-faint">{permission.key}</span>
                  </td>
                  {ROLES.map((role) => (
                    <td key={role} className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#146B4E]"
                        checked={Boolean(granted[`${role}:${permission.key}`])}
                        onChange={() => toggle(role, permission.key)}
                        aria-label={`${permission.label} — ${role}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between gap-4 border-t border-edge px-4 py-3">
        <p className="text-xs text-ink-faint">
          {dirty ? 'فيه تعديلات لسه متحفظتش.' : 'كل التعديلات محفوظة.'}
        </p>
        <Button disabled={!dirty} onClick={() => setDirty(false)}>
          حفظ الصلاحيات
        </Button>
      </div>
    </Card>
  );
}
