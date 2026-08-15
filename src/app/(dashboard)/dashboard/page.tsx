import { Card, PageHeader } from '@/components/ui/primitives';
import { QueueCard } from '@/components/ui/queue-card';
import { DEMO, stock, todayQueue } from '@/data/demo';

/**
 * Overview. Numbers are demo values — real figures come from the API once the
 * seed has run. Nothing here is invented as a business rule; these are just
 * counts of records the system already stores.
 */
export default function DashboardPage() {
  const waiting = todayQueue.filter((v) => v.status === 'waiting').length;
  const inService = todayQueue.filter((v) => v.status === 'in_service').length;
  const lowStock = stock.filter((s) => s.qty <= s.reorder).length;

  return (
    <>
      <PageHeader
        title="نظرة عامة"
        subtitle={DEMO ? 'البيانات المعروضة تجريبية للتطوير — كل سجل عليه isDemo.' : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="في الانتظار الآن" value={waiting} tone="signal" />
        <Stat label="مع الأطباء" value={inService} tone="clinic" />
        <Stat label="حجوزات اليوم" value={todayQueue.length} />
        <Stat label="أصناف تحت حد الطلب" value={lowStock} tone="clay" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section>
          <h2 className="pb-4 font-display text-xl text-ink">الدور الآن</h2>
          <div className="space-y-3">
            {todayQueue
              .filter((v) => v.status !== 'completed')
              .map((visit) => (
                <QueueCard
                  key={visit.id}
                  queueNumber={visit.queueNumber}
                  title={visit.customer}
                  meta={`${visit.doctor} · حضر ${visit.checkedInAt}`}
                  status={visit.status}
                  waitedMinutes={visit.waited}
                />
              ))}
          </div>
        </section>

        <section>
          <h2 className="pb-4 font-display text-xl text-ink">يحتاج انتباه</h2>
          <Card className="divide-y divide-edge">
            {stock
              .filter((s) => s.qty <= s.reorder)
              .map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium text-ink">{item.name}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">{item.warehouse}</p>
                  </div>
                  <p className="num text-sm text-clay">
                    {item.qty} / {item.reorder}
                  </p>
                </div>
              ))}
          </Card>
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'signal' | 'clinic' | 'clay' }) {
  const color =
    tone === 'signal' ? 'text-signal' : tone === 'clinic' ? 'text-clinic-deep' : tone === 'clay' ? 'text-clay' : 'text-ink';
  return (
    <Card className="p-5">
      <p className="eyebrow">{label}</p>
      <p className={`num mt-2 text-3xl font-semibold ${color}`}>{value}</p>
    </Card>
  );
}
