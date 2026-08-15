import Link from 'next/link';
import { QueueCard } from '@/components/ui/queue-card';
import { Card } from '@/components/ui/primitives';
import { branches, doctors, offers } from '@/data/demo';

/**
 * The hero is the booking action itself, not a stock photo of a smiling doctor.
 * What a patient wants on arrival is one thing: pick a branch, pick a doctor,
 * get a slot. Everything else on the page is secondary to that.
 */
export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-12 md:pt-20">
        <div className="grid gap-12 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <p className="eyebrow">١٥ فرعًا في القاهرة والجيزة</p>
            <h1 className="mt-3 font-display text-4xl leading-[1.25] text-ink md:text-5xl">
              احجز في أقرب فرع،
              <br />
              وتابع دورك من موبايلك.
            </h1>
            <p className="mt-5 max-w-md text-ink-muted">
              اختر التخصص والفرع، شوف أقرب ميعاد متاح، واحجز في أقل من دقيقة. هنبعتلك تذكير قبل
              الموعد، وتقدر تشوف رقم دورك لحظة بلحظة وأنت في طريقك.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/book"
                className="rounded-lg bg-clinic px-5 py-3 text-sm font-medium text-white hover:bg-clinic-deep"
              >
                احجز موعد
              </Link>
              <Link
                href="/doctors"
                className="rounded-lg border border-edge-strong px-5 py-3 text-sm font-medium text-ink hover:bg-paper-sunk"
              >
                تصفّح الأطباء
              </Link>
            </div>
          </div>

          {/* The signature card, shown as what the patient ends up holding. */}
          <div className="space-y-3">
            <p className="eyebrow">شكل تذكرتك بعد الحجز</p>
            <QueueCard
              queueNumber={14}
              title="د. أحمد سمير — باطنة"
              meta="فرع المعادي · اليوم 4:30م"
              status="waiting"
              waitedMinutes={0}
            />
            <p className="text-xs text-ink-faint">
              الرقم بيتحدث تلقائيًا لما الدور يقرب. مش محتاج تفضل مستني في العيادة.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex items-end justify-between gap-4 pb-6">
          <h2 className="font-display text-2xl text-ink">أطباء متاحون قريبًا</h2>
          <Link href="/doctors" className="text-sm text-clinic-deep hover:underline">
            كل الأطباء
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((doctor) => (
            <Card key={doctor.id} className="p-5">
              <p className="font-medium text-ink">{doctor.name}</p>
              <p className="mt-1 text-sm text-ink-muted">
                {doctor.specialty} · {branches.find((b) => b.id === doctor.branchId)?.name}
              </p>
              <p className="mt-4 text-sm">
                <span className="text-ink-faint">أقرب موعد: </span>
                <span className="font-medium text-clinic-deep">{doctor.nextSlot}</span>
              </p>
              <Link
                href={`/book?doctor=${doctor.id}`}
                className="mt-4 inline-block text-sm font-medium text-clinic-deep hover:underline"
              >
                احجز مع {doctor.name.split(' ')[1]}
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="pb-6 font-display text-2xl text-ink">عروض الشهر</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {offers.map((offer) => (
            <Card key={offer.id} className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="font-medium text-ink">{offer.title}</p>
                <p className="mt-1 text-sm text-ink-muted">{offer.note}</p>
              </div>
              <p className="num shrink-0 text-lg font-semibold text-clinic-deep">{offer.price}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="pb-6 font-display text-2xl text-ink">الفروع</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {branches.map((branch) => (
            <Card key={branch.id} className="p-5">
              <p className="font-medium text-ink">{branch.name}</p>
              <p className="mt-1 text-sm text-ink-muted">{branch.area}</p>
              <p className="num mt-3 text-sm text-ink-muted">{branch.phone}</p>
              <p className="mt-1 text-sm text-ink-faint">{branch.open}</p>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
