import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '../shared/Reveal';
import { Button } from '../ui/button';

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-lime-soft">
      <div aria-hidden className="float-slow absolute -top-24 -left-20 size-72 rounded-full bg-lime/30 blur-2xl" />
      <div aria-hidden className="float-slow absolute -right-16 -bottom-28 size-80 rounded-full bg-brand/10 blur-2xl [animation-delay:-6s]" />

      <Reveal className="relative mx-auto flex max-w-[960px] flex-col items-center gap-5.5 px-4 py-16 text-center sm:px-8 lg:py-20">
        <h2 className="m-0 text-[32px]/[40px] font-bold text-brand sm:text-[40px]/[48px]">
          Mach deine Speisekarte transparenter.
        </h2>
        <p className="m-0 max-w-[720px] text-base/[26px] font-medium text-black">
          Starte mit einem Gericht und sieh, wie Nährwerte und Allergene für deine Gäste sichtbar werden können.
        </p>
        <Button asChild size="lg">
          <Link href="/kontakt">
            Jetzt kostenlos starten
            <ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </Button>
      </Reveal>
    </section>
  );
}
