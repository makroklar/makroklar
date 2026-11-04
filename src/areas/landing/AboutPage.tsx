import { Eye, HeartHandshake, ShieldCheck } from 'lucide-react';
import { FinalCta } from './components/cta/FinalCta';
import { PageHeader } from './components/shared/PageHeader';
import { Reveal } from './components/shared/Reveal';
import { Todo } from './components/shared/Todo';

const values = [
  {
    icon: Eye,
    title: 'Transparenz',
    text: 'Wer auswärts isst, soll wissen können, was auf dem Teller ist.',
  },
  {
    icon: ShieldCheck,
    title: 'Verlässlichkeit',
    text: 'Betriebe prüfen jede Angabe, bevor Gäste sie sehen.',
  },
  {
    icon: HeartHandshake,
    title: 'Nähe',
    text: 'Wir sprechen mit Betroffenen und der Gastronomie und bauen auf das, was wir dort hören.',
  },
];

export function AboutPage() {
  return (
    <div className="w-full min-w-0">
      <PageHeader eyebrow="Über uns" title="Essen gehen soll einfacher werden">
        makroklar macht Nährwerte und Allergene im Restaurant verständlich, besonders für Menschen mit Diabetes.
      </PageHeader>

      <section className="bg-card">
        <div className="mx-auto max-w-[760px] px-4 py-14 sm:px-8">
          <Reveal>
            <h2 className="mb-3 text-[28px]/[36px] font-bold text-brand">Warum es uns gibt</h2>
            <p className="mb-3 text-base/[26px] text-ink">
              Wer mit Diabetes lebt, muss Kohlenhydrate einschätzen können. Im Restaurant geht das oft nur nach Gefühl.
              In unseren Interviews haben Betroffene genau das beschrieben: Schon ein ungefährer Wert auf der
              Speisekarte würde ihnen helfen.
            </p>
            <p className="m-0 text-base/[26px] text-ink">
              <Todo>Projektgeschichte: Hochschule, Studiengang, wann und wie makroklar entstanden ist</Todo>
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-page">
        <div className="mx-auto grid max-w-[1100px] gap-5 px-4 py-14 sm:px-8 md:grid-cols-3">
          {values.map(({ icon: Icon, title, text }, index) => (
            <Reveal key={title} delay={index * 0.08}>
              <article className="flex h-full flex-col gap-3 rounded-[22px] bg-lime-soft p-6">
                <Icon aria-hidden className="size-7 text-brand" strokeWidth={1.75} />
                <h3 className="m-0 text-xl/[25px] font-bold text-brand">{title}</h3>
                <p className="m-0 text-sm/[22px] text-ink">{text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-card">
        <div className="mx-auto max-w-[760px] px-4 py-14 text-center sm:px-8">
          <Reveal>
            <h2 className="mb-3 text-[28px]/[36px] font-bold text-brand">Das Team</h2>
            <p className="m-0 text-base/[26px] text-ink">
              <Todo>Namen, Rollen und Fotos des Teams</Todo>
            </p>
          </Reveal>
        </div>
      </section>

      <FinalCta />
    </div>
  );
}
