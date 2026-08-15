'use client';

import { useMemo, useState } from 'react';
import { Button, Card } from '@/components/ui/primitives';
import { QueueCard } from '@/components/ui/queue-card';

/**
 * Three steps, one screen: branch → doctor → time.
 * A patient on a phone should never wonder how many steps are left, so the
 * whole flow stays visible and collapses as choices are made.
 *
 * BUSINESS_RULE_PENDING: real slot availability, cancellation window and any
 * deposit rule. The times below are placeholders from demo data — this
 * component reads them from props so wiring the real endpoint changes nothing
 * else.
 */

interface Branch { id: string; name: string; area: string }
interface Specialty { id: string; name: string }
interface Doctor { id: string; name: string; specialty: string; branchId: string; nextSlot: string }

const DEMO_SLOTS = ['10:00ص', '11:30ص', '1:00م', '4:30م', '6:00م', '7:30م'];

export function BookingFlow({
  branches,
  specialties,
  doctors,
}: {
  branches: Branch[];
  specialties: Specialty[];
  doctors: Doctor[];
}) {
  const [branchId, setBranchId] = useState<string | null>(null);
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const available = useMemo(
    () =>
      doctors.filter(
        (d) => (!branchId || d.branchId === branchId) && (!specialty || d.specialty === specialty),
      ),
    [doctors, branchId, specialty],
  );

  const doctor = doctors.find((d) => d.id === doctorId);
  const branch = branches.find((b) => b.id === branchId);
  const canConfirm = Boolean(branchId && doctorId && slot);

  if (confirmed && doctor && branch && slot) {
    return (
      <div className="space-y-4">
        <QueueCard
          queueNumber={14}
          title={`${doctor.name} — ${doctor.specialty}`}
          meta={`${branch.name} · ${slot}`}
          status="waiting"
        />
        <p className="text-sm text-ink-muted">
          حجزك مسجّل. هيوصلك تأكيد على موبايلك، وتقدر تتابع رقم دورك من صفحة «مواعيدي» يوم الزيارة.
        </p>
        <Button variant="ghost" onClick={() => setConfirmed(false)}>
          تعديل الحجز
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="eyebrow">الفرع</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {branches.map((b) => (
            <Chip key={b.id} active={branchId === b.id} onClick={() => setBranchId(b.id)}>
              {b.name}
            </Chip>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <p className="eyebrow">التخصص</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {specialties.map((s) => (
            <Chip
              key={s.id}
              active={specialty === s.name}
              onClick={() => setSpecialty(specialty === s.name ? null : s.name)}
            >
              {s.name}
            </Chip>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <p className="eyebrow">الطبيب</p>
        {available.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            مفيش أطباء بالاختيارات دي. جرّب فرع تاني أو تخصص مختلف.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {available.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDoctorId(d.id)}
                className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-start transition-colors ${
                  doctorId === d.id
                    ? 'border-clinic bg-clinic-light'
                    : 'border-edge hover:bg-paper-sunk'
                }`}
              >
                <span>
                  <span className="block font-medium text-ink">{d.name}</span>
                  <span className="block text-sm text-ink-muted">{d.specialty}</span>
                </span>
                <span className="text-sm text-clinic-deep">{d.nextSlot}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <p className="eyebrow">الميعاد</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO_SLOTS.map((s) => (
            <Chip key={s} active={slot === s} onClick={() => setSlot(s)}>
              <span className="num">{s}</span>
            </Chip>
          ))}
        </div>
      </Card>

      <Button disabled={!canConfirm} onClick={() => setConfirmed(true)}>
        {canConfirm ? 'أكّد الحجز' : 'اختار الفرع والطبيب والميعاد'}
      </Button>
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-4 py-2 text-sm transition-colors ${
        active ? 'border-clinic bg-clinic text-white' : 'border-edge text-ink hover:bg-paper-sunk'
      }`}
    >
      {children}
    </button>
  );
}
