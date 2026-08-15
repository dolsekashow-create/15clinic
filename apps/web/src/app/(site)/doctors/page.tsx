import Link from 'next/link';
import { Card, PageHeader } from '@/components/ui/primitives';
import { branches, doctors } from '@/data/demo';

export default function DoctorsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <PageHeader title="الأطباء" subtitle="اختر الطبيب المناسب وشوف أقرب موعد متاح في فرعه." />

      <div className="grid gap-4 md:grid-cols-2">
        {doctors.map((doctor) => (
          <Card key={doctor.id} className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-xl text-ink">{doctor.name}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {doctor.specialty} · خبرة <span className="num">{doctor.years}</span> سنة
                </p>
                <p className="mt-3 text-sm text-ink-muted">
                  {branches.find((b) => b.id === doctor.branchId)?.name}
                </p>
              </div>
              <div className="text-end">
                <p className="eyebrow">أقرب موعد</p>
                <p className="mt-1 text-sm font-medium text-clinic-deep">{doctor.nextSlot}</p>
              </div>
            </div>

            <Link
              href={`/book?doctor=${doctor.id}`}
              className="mt-5 inline-block rounded-lg bg-clinic px-4 py-2 text-sm font-medium text-white hover:bg-clinic-deep"
            >
              احجز
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
