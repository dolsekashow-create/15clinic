import { Button, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { QueueCard } from '@/components/ui/queue-card';
import { attendanceService } from '@clinic/services';
import { getServerContext } from '@/lib/server-session';
import { todayQueue as demoQueue } from '@/data/demo';

/**
 * The reception screen — the one page that is open all day.
 * Waiting patients come first and are never behind a tab; completed visits
 * drop to a quiet list below.
 */
export default async function ReceptionPage() {
  const ctx = await getServerContext();
  const branchId = ctx?.branchIds[0];

  // Live queue once a session and a branch exist; demo rows before that.
  const visits =
    ctx && branchId
      ? (await attendanceService.todayQueue(ctx, branchId)).items.map((v) => ({
          id: v.id,
          queueNumber: v.queueNumber,
          customer: v.customerId,
          doctor: v.doctorId ?? '—',
          status: v.status,
          checkedInAt: v.checkInAt.slice(11, 16),
          waited: v.waitMinutes ?? 0,
        }))
      : demoQueue;

  const open = visits.filter((v) => v.status !== 'completed');
  const done = visits.filter((v) => v.status === 'completed');

  return (
    <>
      <PageHeader
        title="الاستقبال والدور"
        subtitle="سجّل حضور العميل عشان ياخد رقم دوره، وسجّل انصرافه لما يخلص."
        action={<Button>تسجيل حضور</Button>}
      />

      {open.length === 0 ? (
        <EmptyState
          title="مفيش حد في الانتظار"
          hint="أول ما عميل يوصل، سجّل حضوره وهياخد رقم دور تلقائي."
          action={<Button>تسجيل حضور</Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {open.map((visit) => (
            <div key={visit.id} className="space-y-2">
              <QueueCard
                queueNumber={visit.queueNumber}
                title={visit.customer}
                meta={`${visit.doctor} · حضر ${visit.checkedInAt}`}
                status={visit.status}
                waitedMinutes={visit.waited}
              />
              <div className="flex gap-2">
                {visit.status === 'waiting' ? <Button variant="ghost">نداء</Button> : null}
                <Button variant="ghost">تسجيل انصراف</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {done.length > 0 ? (
        <section className="mt-10">
          <h2 className="pb-3 font-display text-lg text-ink">انصرفوا اليوم</h2>
          <Card className="divide-y divide-edge">
            {done.map((visit) => (
              <div key={visit.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span className="num w-8 text-ink-faint">{visit.queueNumber}</span>
                <span className="flex-1 text-ink">{visit.customer}</span>
                <span className="text-ink-muted">{visit.doctor}</span>
                <span className="num text-ink-faint">{visit.waited} د انتظار</span>
              </div>
            ))}
          </Card>
        </section>
      ) : null}
    </>
  );
}
