import Link from 'next/link';

/**
 * Dashboard shell.
 *
 * The sidebar is grouped by what a person does, not by database table:
 * "اليوم" (what is happening now), "الإدارة" (people and structure),
 * "المال والمخزن". A receptionist and an accountant should each find their
 * work in one place.
 *
 * TODO: hide links the signed-in user lacks permission for. That is cosmetic —
 * the API enforces every permission server-side regardless of what is rendered.
 */

const groups = [
  {
    label: 'اليوم',
    items: [
      { href: '/dashboard', label: 'نظرة عامة' },
      { href: '/dashboard/reception', label: 'الاستقبال والدور' },
      { href: '/dashboard/appointments', label: 'الحجوزات' },
      { href: '/dashboard/customers', label: 'العملاء' },
    ],
  },
  {
    label: 'الإدارة',
    items: [
      { href: '/dashboard/users', label: 'المستخدمون والصلاحيات' },
      { href: '/dashboard/branches', label: 'الفروع والأقسام' },
      { href: '/dashboard/doctors', label: 'الأطباء' },
      { href: '/dashboard/services', label: 'الخدمات والعروض' },
    ],
  },
  {
    label: 'المال والمخزن',
    items: [
      { href: '/dashboard/invoices', label: 'الفواتير والتحصيل' },
      { href: '/dashboard/accounting', label: 'القيود والتقارير' },
      { href: '/dashboard/inventory', label: 'المخزن' },
    ],
  },
  {
    label: 'النظام',
    items: [
      { href: '/dashboard/audit-logs', label: 'سجل العمليات' },
      { href: '/dashboard/settings', label: 'الإعدادات' },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-edge bg-paper-card lg:min-h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-s lg:border-edge">
        <div className="px-5 py-5">
          <p className="font-display text-lg font-bold text-clinic-deep">مجموعة العيادات</p>
          <p className="mt-0.5 text-xs text-ink-faint">لوحة التحكم</p>
        </div>

        <nav className="px-3 pb-6">
          {groups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="eyebrow px-2 pb-2">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-paper-sunk hover:text-ink"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex-1">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-edge bg-paper-card px-6 py-3">
          {/* Which branch you are looking at is the single most important piece
              of context in a 15-branch system — it stays visible at all times. */}
          <div className="flex items-center gap-3">
            <span className="eyebrow">الفرع الحالي</span>
            <select
              className="rounded-lg border border-edge bg-paper-card px-3 py-1.5 text-sm text-ink"
              defaultValue="branch_maadi"
              aria-label="اختيار الفرع"
            >
              <option value="branch_maadi">فرع المعادي</option>
              <option value="branch_nasr">فرع مدينة نصر</option>
              <option value="branch_giza">فرع الجيزة</option>
            </select>
          </div>

          <div className="flex items-center gap-4 text-sm text-ink-muted">
            <Link href="/dashboard/notifications" className="hover:text-ink">
              الإشعارات
            </Link>
            <span className="hidden sm:inline">ياسمين طارق</span>
          </div>
        </header>

        <div className="px-6 py-8">{children}</div>
      </div>
    </div>
  );
}
