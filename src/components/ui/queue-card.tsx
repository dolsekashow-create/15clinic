import { StatusPill } from './primitives';

/**
 * The signature object of this interface.
 *
 * A clinic's real artifact is the paper slip with a queue number on it, so the
 * booking confirmation and the reception screen share one component: a punched
 * card with a torn lower edge and the number set large in mono.
 */
export function QueueCard({
  queueNumber,
  title,
  meta,
  status,
  waitedMinutes,
}: {
  queueNumber: number;
  title: string;
  meta: string;
  status: string;
  waitedMinutes?: number;
}) {
  return (
    <article className="queue-card p-4 pb-6" data-state={status}>
      <div className="flex items-start gap-4 ps-2">
        <div className="shrink-0 text-center">
          <p className="eyebrow">الدور</p>
          <p className="num text-4xl font-semibold leading-none text-ink">{queueNumber}</p>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{title}</p>
          <p className="mt-0.5 truncate text-sm text-ink-muted">{meta}</p>
          <div className="mt-2.5 flex items-center gap-2">
            <StatusPill status={status} />
            {typeof waitedMinutes === 'number' && status !== 'completed' ? (
              <span className="text-xs text-ink-faint">
                انتظر <span className="num">{waitedMinutes}</span> دقيقة
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
