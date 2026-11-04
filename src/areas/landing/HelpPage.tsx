import Link from 'next/link';
import { FinalCta } from './components/cta/FinalCta';
import { PageHeader } from './components/shared/PageHeader';
import { Reveal } from './components/shared/Reveal';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './components/ui/accordion';
import { faqGroups } from './content/help';

export function HelpPage() {
  return (
    <div className="w-full min-w-0">
      <PageHeader eyebrow="Hilfe & FAQ" title="Wie können wir helfen?">
        Antworten auf die häufigsten Fragen. Deine Frage fehlt? <Link href="/kontakt">Schreib uns.</Link>
      </PageHeader>

      <div className="bg-page">
        <div className="mx-auto flex max-w-[800px] flex-col gap-10 px-4 pb-16 sm:px-8">
          {faqGroups.map((group) => (
            <Reveal key={group.title}>
              <section>
                <h2 className="mb-4 text-2xl/8 font-bold text-brand">{group.title}</h2>
                <Accordion type="single" collapsible className="flex flex-col gap-3">
                  {group.items.map((item) => (
                    <AccordionItem key={item.question} value={item.question}>
                      <AccordionTrigger>{item.question}</AccordionTrigger>
                      <AccordionContent>{item.answer}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            </Reveal>
          ))}
        </div>
      </div>

      <FinalCta />
    </div>
  );
}
