import { PermissionMatrix } from '@/components/dashboard/permission-matrix';
import { Button, Card, EmptyState, PageHeader, StatusPill } from '@/components/ui/primitives';
import { userService } from '@/server/services';
import { can, getServerContext } from '@/lib/server-session';
import { demoUsers } from '@/data/demo';

/**
 * User and permission management — the owner's control panel.
 *
 * Roles are editable data, not code. Adding a role or moving a permission here
 * changes what the API allows on the next request, because the server resolves
 * permissions from the database rather than from the token.
 */
export default async function UsersPage() {
  const ctx = await getServerContext();

  // Real data when a session exists and the seed has run; demo rows otherwise
  // so the screen is still reviewable before Firebase is configured.
  const users = ctx
    ? (await userService.listWithAccess(ctx)).map((u) => ({
        id: u.id,
        name: u.fullName,
        email: u.email,
        role: u.roles.map((r) => r.name).join('، ') || '—',
        branches: u.branchIds.length > 0 ? u.branchIds : ['—'],
        status: u.status,
      }))
    : demoUsers;

  if (ctx && !can(ctx, 'users.view')) {
    return (
      <EmptyState
        title="لا تملك صلاحية عرض المستخدمين"
        hint="اطلب من مدير النظام إضافة صلاحية users.view لدورك."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="المستخدمون والصلاحيات"
        subtitle="أضف موظف، حدد دوره والفروع اللي يشوفها، أو أوقف حسابه فورًا."
        action={<Button>إضافة مستخدم</Button>}
      />

      <Card className="overflow-hidden">
        <table className="w-full text-start text-sm">
          <thead className="bg-paper-sunk text-ink-muted">
            <tr>
              <th className="px-4 py-3 text-start font-medium">الاسم</th>
              <th className="px-4 py-3 text-start font-medium">الدور</th>
              <th className="px-4 py-3 text-start font-medium">الفروع</th>
              <th className="px-4 py-3 text-start font-medium">الحالة</th>
              <th className="px-4 py-3 text-start font-medium">‎</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{user.name}</p>
                  <p className="text-xs text-ink-faint">{user.email}</p>
                </td>
                <td className="px-4 py-3 text-ink-muted">{user.role}</td>
                <td className="px-4 py-3 text-ink-muted">{user.branches.join('، ')}</td>
                <td className="px-4 py-3">
                  <StatusPill status={user.status} />
                </td>
                <td className="px-4 py-3 text-end">
                  <button className="text-sm text-clinic-deep hover:underline">تعديل</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <section className="mt-10">
        <h2 className="pb-1 font-display text-xl text-ink">صلاحيات الأدوار</h2>
        <p className="pb-5 text-sm text-ink-muted">
          التعديل هنا بيسري على كل المستخدمين اللي عندهم الدور ده من الطلب اللي بعده مباشرة.
        </p>
        <PermissionMatrix />
      </section>
    </>
  );
}
