import type { ReactNode } from 'react';
import { Reveal } from './Reveal';

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <header className="bg-page">
      <Reveal className="mx-auto flex max-w-[860px] flex-col items-center gap-4 px-4 pt-12 pb-10 text-center sm:px-8 lg:pt-16 lg:pb-14">
        <p className="m-0 rounded-full bg-lime-soft px-3 py-1.75 text-[11px] font-bold text-brand uppercase">{eyebrow}</p>
        <h1 className="m-0 text-[36px]/[44px] font-bold text-brand sm:text-[44px]/[54px]">{title}</h1>
        {children && <p className="m-0 max-w-[680px] text-base/[26px] text-ink sm:text-lg/7">{children}</p>}
      </Reveal>
    </header>
  );
}
