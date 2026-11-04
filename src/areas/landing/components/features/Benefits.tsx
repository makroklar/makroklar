import { benefits } from '../../content/home';
import { Reveal } from '../shared/Reveal';
import { SectionHeading } from '../shared/SectionHeading';

export function Benefits() {
  return (
    <section id="vorteile" className="bg-card">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-11 px-4 py-14 sm:px-8 lg:py-18 xl:px-20">
        <SectionHeading title="Was mit makroklar möglich wird">
          Transparenz, die bisher kaum Platz auf Speisekarten hatte.
        </SectionHeading>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {benefits.map(({ icon: Icon, title, text }, index) => (
            <Reveal key={title} delay={index * 0.08}>
              <article className="group flex h-full flex-col gap-4.5 rounded-[22px] bg-lime-soft p-6 transition duration-300 hover:-translate-y-1 hover:shadow-panel xl:min-h-[285px]">
                <div className="flex size-13 items-center justify-center rounded-[14px] bg-card text-brand transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                  <Icon aria-hidden className="size-7" strokeWidth={1.75} />
                </div>
                <h3 className="m-0 text-xl/[25px] font-bold text-brand">{title}</h3>
                <p className="m-0 text-sm/[22px] text-ink">{text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
