import { Check } from 'lucide-react';
import { FinalCta } from './components/cta/FinalCta';
import { PageHeader } from './components/shared/PageHeader';
import { Reveal } from './components/shared/Reveal';

const chapters = [
  {
    title: 'Gerichte auswählen',
    text: 'Starte klein. Wähle ein paar Gerichte, die oft bestellt werden oder bei denen Gäste häufig nachfragen.',
    tips: ['Beliebte Gerichte zuerst', 'Klare Portionsgrößen festlegen'],
  },
  {
    title: 'Rezepte zusammentragen',
    text: 'Lade deine Speisekarte oder Rezeptdaten hoch. Je genauer die Mengen sind, desto besser werden die Werte.',
    tips: ['Mengen möglichst in Gramm angeben', 'Soßen und Beilagen nicht vergessen'],
  },
  {
    title: 'Entwurf prüfen',
    text: 'makroklar erkennt Zutaten, Mengen und Allergene und zeigt, wo Informationen fehlen. Du ergänzt und korrigierst.',
    tips: ['Fertigprodukte mit dem Etikett abgleichen', 'Allergene mit der Küche durchgehen'],
  },
  {
    title: 'Für Gäste freigeben',
    text: 'Nur freigegebene Gerichte erscheinen in der digitalen Speisekarte. Gäste sehen die Werte, nicht deine Rezepte.',
    tips: ['QR-Code gut sichtbar platzieren', 'Team kurz einweisen'],
  },
  {
    title: 'Aktuell halten',
    text: 'Ändert sich ein Rezept oder ein Lieferant, passe das Gericht an. So bleiben die Angaben verlässlich.',
    tips: ['Neue Gerichte direkt ergänzen', 'Angaben regelmäßig kontrollieren'],
  },
];

export function GuidePage() {
  return (
    <div className="w-full min-w-0">
      <PageHeader eyebrow="Anleitung für Gastronomie" title="In fünf Schritten zur transparenten Speisekarte">
        So führst du Nährwert- und Allergenangaben in deinem Betrieb ein, ohne den Alltag aufzuhalten.
      </PageHeader>

      <div className="bg-page">
        <ol className="m-0 mx-auto flex max-w-[860px] list-none flex-col gap-5 px-4 pb-16 sm:px-8">
          {chapters.map((chapter, index) => (
            <li key={chapter.title}>
              <Reveal>
                <article className="flex flex-col gap-4 rounded-3xl border border-line bg-card p-6 sm:flex-row sm:gap-6 sm:p-7">
                  <span className="flex size-11.5 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-lime">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h2 className="mb-2 text-[22px]/[29px] font-bold text-brand">{chapter.title}</h2>
                    <p className="mb-3 text-[15px]/6 text-ink">{chapter.text}</p>
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                      {chapter.tips.map((tip) => (
                        <li key={tip} className="flex items-start gap-2 text-sm/[22px] text-ink-subtle">
                          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>

      <FinalCta />
    </div>
  );
}
