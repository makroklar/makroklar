import { quotes } from '../../content/home';
import { Reveal } from '../shared/Reveal';
import { SectionHeading } from '../shared/SectionHeading';

export function Community() {
  return (
    <section id="community" className="bg-brand">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-4 py-14 sm:px-8 lg:py-18 xl:px-20">
        <SectionHeading title="Warum Transparenz im Restaurant zählt" inverted>
          Echte Stimmen von Menschen mit Diabetes aus geführten Interviews.
        </SectionHeading>

        {/* Auf dem Handy wischbar, ab lg als Raster */}
        <div
          tabIndex={0}
          role="group"
          aria-label="Interviewzitate"
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-5.5 lg:overflow-visible lg:px-0"
        >
          {quotes.map((quote, index) => (
            <Reveal key={quote.text} delay={index * 0.1} className="w-[85%] shrink-0 snap-center sm:w-[60%] lg:w-auto">
              <figure className="m-0 flex h-full flex-col gap-5 rounded-[22px] bg-card px-6.5 py-6 transition-transform duration-300 hover:-translate-y-1">
                <span className="self-start rounded-full bg-lime-soft px-2.5 py-1.5 text-[9px] font-bold text-brand">
                  INTERVIEWZITAT
                </span>
                <blockquote className="m-0 flex-1 text-[17px]/[27px] font-bold text-black">{quote.text}</blockquote>
                <figcaption className="flex items-center gap-2.5 text-xs text-black">
                  <span aria-hidden className="size-8.5 rounded-full bg-lime" />
                  {quote.source}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
