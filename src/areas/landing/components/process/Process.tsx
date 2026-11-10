import { SectionHeading } from '../shared/SectionHeading';
import { ProcessSteps } from './ProcessSteps';

export function Process() {
  return (
    <section id="ablauf" className="bg-page">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-11 px-4 py-14 sm:px-8 lg:py-18 xl:px-28">
        <SectionHeading title="So kommt Transparenz auf die Speisekarte">
          Du lieferst die Grundlage. makroklar macht den Rest und du behältst jederzeit die Kontrolle.
        </SectionHeading>
        <ProcessSteps />
      </div>
    </section>
  );
}
