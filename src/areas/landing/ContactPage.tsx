import { Check } from 'lucide-react';
import { ContactForm } from './components/contact/ContactForm';
import { PageHeader } from './components/shared/PageHeader';
import { Reveal } from './components/shared/Reveal';

const nextSteps = [
  'Du schreibst uns kurz, wer du bist und welchen Betrieb du hast.',
  'Wir melden uns und besprechen den Start in der Pilotphase.',
  'Du bekommst deinen Zugang und legst die ersten Gerichte an.',
];

export function ContactPage() {
  return (
    <div className="w-full min-w-0">
      <PageHeader eyebrow="Kontakt" title="Lass uns sprechen">
        Du möchtest makroklar kostenlos ausprobieren oder hast eine Frage? Schreib uns.
      </PageHeader>

      <div className="bg-page">
        <div className="mx-auto grid max-w-[1000px] items-start gap-10 px-4 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <Reveal>
            <h2 className="mb-4 text-2xl/8 font-bold text-brand">So geht es weiter</h2>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {nextSteps.map((step) => (
                <li key={step} className="flex items-start gap-2.5 text-[15px]/6 text-ink">
                  <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
                  {step}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <ContactForm />
          </Reveal>
        </div>
      </div>
    </div>
  );
}
