import { Card, PageHeader } from '@/components/ui/primitives';
import { offers } from '@/data/demo';

export default function OffersPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <PageHeader title="العروض" subtitle="عروض سارية في كل الفروع ما لم يُذكر غير ذلك." />

      <div className="grid gap-4 sm:grid-cols-2">
        {offers.map((offer) => (
          <Card key={offer.id} className="p-6">
            <p className="font-display text-xl text-ink">{offer.title}</p>
            <p className="mt-2 text-sm text-ink-muted">{offer.note}</p>
            <p className="num mt-4 text-lg font-semibold text-clinic-deep">{offer.price}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
