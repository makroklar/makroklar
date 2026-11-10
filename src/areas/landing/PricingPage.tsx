import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { PageHeader } from './components/shared/PageHeader';
import { Reveal } from './components/shared/Reveal';
import { Button } from './components/ui/button';

const included = [
  'Gerichte und Rezepte anlegen',
  'Nährwerte und Allergene als Entwurf',
  'Angaben vor der Veröffentlichung prüfen',
  'Digitale Speisekarte für deine Gäste',
  'Persönliche Begleitung beim Start',
];

export function PricingPage() {
  return (
    <div className="w-full min-w-0">
      <PageHeader eyebrow="Preise & Pakete" title="Jetzt in der Pilotphase kostenlos">
        Wir entwickeln makroklar gemeinsam mit den ersten Betrieben. Feste Pakete gibt es noch nicht.
      </PageHeader>

      <div className="bg-page">
        <div className="mx-auto max-w-[560px] px-4 pb-16 sm:px-8">
          <Reveal>
            <section className="flex flex-col gap-5 rounded-3xl border border-brand bg-card p-7 shadow-panel">
              <div>
                <h2 className="mb-1 text-2xl/8 font-bold text-brand">Pilotphase</h2>
                <p className="m-0 text-[15px]/6 text-ink-subtle">Für Restaurants, Cafés und Bäckereien</p>
              </div>
              <p className="m-0 text-[40px]/[48px] font-bold text-brand">0 €</p>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {included.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[15px]/6 text-ink">
                    <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button asChild size="lg">
                <Link href="/kontakt">
                  Kostenlos ausprobieren
                  <ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <p className="m-0 text-center text-[13px]/5 text-ink-subtle">
                Bevor sich für dich etwas ändert, sagen wir dir rechtzeitig Bescheid.
              </p>
            </section>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
