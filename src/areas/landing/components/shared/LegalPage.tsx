import type { ReactNode } from 'react';
import { PageHeader } from './PageHeader';

export function LegalPage({ title, notice, children }: { title: string; notice: string; children: ReactNode }) {
  return (
    <div className="w-full min-w-0 bg-card">
      <PageHeader eyebrow="Rechtliches" title={title} />
      <div className="mx-auto flex max-w-[760px] flex-col gap-8 px-4 py-12 sm:px-8 lg:py-16">
        <p className="m-0 rounded-xl bg-lime-soft p-4 text-sm/[22px] text-ink">{notice}</p>
        {children}
      </div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 text-[15px]/[25px] text-ink [&_p]:m-0">
      <h2 className="m-0 text-xl/[28px] font-bold text-brand">{title}</h2>
      {children}
    </section>
  );
}
