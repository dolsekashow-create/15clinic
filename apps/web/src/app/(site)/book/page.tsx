import { BookingFlow } from '@/components/site/booking-flow';
import { branches, doctors, specialties } from '@/data/demo';

export default function BookPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="eyebrow">حجز موعد</p>
      <h1 className="mt-2 font-display text-3xl text-ink">اختار الفرع والطبيب والميعاد</h1>
      <p className="mt-2 text-sm text-ink-muted">
        الحجز مبدئي حتى يتأكد من الفرع. هيوصلك تأكيد على رقم موبايلك.
      </p>

      <div className="mt-8">
        <BookingFlow branches={branches} specialties={specialties} doctors={doctors} />
      </div>
    </div>
  );
}
