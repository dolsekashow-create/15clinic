import type { ReactNode } from 'react';

type Tone = 'default' | 'clinic' | 'signal' | 'clay' | 'muted';

const toneClasses: Record<Tone, string> = {
  default: 'bg-paper-sunk text-ink',
  clinic: 'bg-clinic-light text-clinic-deep',
  signal: 'bg-signal-light text-signal',
  clay: 'bg-clay-light text-clay',
  muted: 'bg-paper-sunk text-ink-faint',
};

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-edge bg-paper-card shadow-card ${className}`}>{children}</div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div>
        <h1 className="font-display text-3xl leading-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Button({
  children,
  variant = 'primary',
  type = 'button',
  ...rest
}: {
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'danger';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: 'bg-clinic text-white hover:bg-clinic-deep',
    ghost: 'border border-edge-strong text-ink hover:bg-paper-sunk',
    danger: 'border border-clay text-clay hover:bg-clay-light',
  }[variant];

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${styles}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Empty states are an invitation to act, not an apology. */
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-edge-strong px-6 py-14 text-center">
      <p className="font-display text-xl text-ink">{title}</p>
      {hint ? <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">{hint}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: Tone }> = {
    waiting: { label: 'في الانتظار', tone: 'signal' },
    called: { label: 'تم النداء', tone: 'signal' },
    in_service: { label: 'مع الطبيب', tone: 'clinic' },
    completed: { label: 'انصرف', tone: 'muted' },
    left_without_service: { label: 'غادر بدون خدمة', tone: 'clay' },
    active: { label: 'نشط', tone: 'clinic' },
    suspended: { label: 'موقوف', tone: 'clay' },
  };
  const entry = map[status] ?? { label: status, tone: 'default' as Tone };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
