import Link from "next/link";
import { LanguageToggle } from "@/components/LanguageToggle";

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 py-8">
      <section className="soft-grid rounded-3xl border border-white/70 bg-white/60 p-6 shadow-floating backdrop-blur">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-black tracking-tight text-brand-ink">Patungin</h1>
          <LanguageToggle />
        </div>
        <p className="text-slate-700">Aplikasi split bill mobile-first untuk momen nongkrong, trip, dan patungan harian.</p>
        <div className="mt-6 space-y-3">
          <Link href="/dashboard" className="block rounded-2xl bg-brand-ink px-4 py-3 text-center font-semibold text-white">
            Open Dashboard
          </Link>
          <Link href="/expenses/new" className="block rounded-2xl border border-brand-ink/20 bg-white px-4 py-3 text-center font-semibold text-brand-ink">
            Add Expense
          </Link>
        </div>
      </section>
    </main>
  );
}
