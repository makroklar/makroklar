import Link from 'next/link';
import { ArrowRight, CircleCheck, CirclePlay } from 'lucide-react';
import { Reveal } from '../shared/Reveal';
import { Button } from '../ui/button';
import { HeroDemo } from './HeroDemo';

export function Hero() {
  return (
    <section className="overflow-hidden bg-page">
      <div className="mx-auto grid max-w-[1440px] items-center gap-12 px-4 pt-10 pb-14 sm:px-8 lg:pt-14 lg:pb-16 xl:grid-cols-[minmax(0,590px)_540px] xl:justify-between xl:px-20 2xl:px-28">
        <div className="flex flex-col items-start gap-6">
          <Reveal>
            <p className="m-0 rounded-full bg-lime-soft px-3 py-1.75 text-[11px] font-bold text-brand">
              NÄHRWERTTRANSPARENZ FÜR DIE GASTRONOMIE
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="m-0 text-[40px]/[48px] font-bold text-brand sm:text-[54px]/[64px]">
              Zeig deinen Gästen, was in deinen Gerichten steckt.
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="m-0 max-w-[550px] text-lg/7 text-black sm:text-xl/[30px]">
              makroklar. macht aus Rezepten verständliche Nährwert- und Allergenangaben für Speisekarten, auf denen
              Menschen sicherer auswählen können.
            </p>
          </Reveal>
          <Reveal delay={0.24} className="flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <Link href="/kontakt">
                Kostenlos ausprobieren
                <ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Link
              href="#ablauf"
              className="flex items-center gap-2 py-3 text-sm font-bold text-brand no-underline hover:underline"
            >
              So funktioniert’s
              <CirclePlay aria-hidden className="size-4.5" />
            </Link>
          </Reveal>
          <Reveal delay={0.32}>
            <p className="m-0 flex items-center gap-2.5 text-[13px] text-black">
              <CircleCheck aria-hidden className="size-4.5 shrink-0 text-brand" />
              Für Restaurants, Cafés und Bäckereien
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.2}>
          <HeroDemo />
        </Reveal>
      </div>
    </section>
  );
}
