import Link from 'next/link';

// Only pages that exist. A nav link to a 404 is worse than no link.
const nav = [
  { href: '/doctors', label: 'الأطباء' },
  { href: '/offers', label: 'العروض' },
];

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-edge bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4">
          <Link href="/" className="font-display text-xl font-bold text-clinic-deep">
            مجموعة العيادات
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-ink-muted md:flex">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-clinic-deep">
                {item.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/book"
            className="rounded-lg bg-clinic px-4 py-2 text-sm font-medium text-white hover:bg-clinic-deep"
          >
            احجز موعد
          </Link>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-24 border-t border-edge bg-paper-card">
        <div className="mx-auto max-w-6xl px-5 py-10 text-sm text-ink-muted">
          <p className="font-display text-lg text-ink">مجموعة العيادات</p>
          <p className="mt-2">للطوارئ اتصل بالفرع مباشرة — الحجز عبر الموقع للمواعيد العادية فقط.</p>
        </div>
      </footer>
    </div>
  );
}
