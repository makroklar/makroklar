'use client';

import { Fragment, useRef, type CSSProperties } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { steps } from '../../content/home';
import { cn } from '../../lib/utils';

const STEP_DELAY_MS = 700;

// Auf dem Desktop läuft die Reihe nacheinander ab, auf dem Handy startet jedes Element beim Hineinscrollen
const sequencedTransition = 'duration-500 ease-out motion-reduce:transition-none lg:[transition-delay:var(--sequence-delay)]';

function useReached() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -20% 0px' });
  const reduced = useReducedMotion();
  return { ref, reached: inView || Boolean(reduced) };
}

function Step({ index, title, text }: { index: number; title: string; text: string }) {
  const { ref, reached } = useReached();

  return (
    <div ref={ref} className="flex flex-1">
      <article
        style={{ '--sequence-delay': `${index * STEP_DELAY_MS}ms` } as CSSProperties}
        className={cn(
          'flex w-full flex-col gap-4.5 rounded-3xl border bg-card p-6.5 transition',
          sequencedTransition,
          reached ? 'translate-y-0 border-brand opacity-100 shadow-panel' : 'translate-y-3 border-line opacity-60',
        )}
      >
        <div
          className={cn(
            'flex size-11.5 items-center justify-center rounded-full text-sm font-bold transition',
            sequencedTransition,
            reached ? 'bg-brand text-lime' : 'bg-page text-ink-muted',
          )}
        >
          {String(index + 1).padStart(2, '0')}
        </div>
        <h3 className="m-0 text-[22px]/[29px] font-bold text-brand">{title}</h3>
        <p className="m-0 text-sm/[22px] text-ink">{text}</p>
      </article>
    </div>
  );
}

function Connector({ index }: { index: number }) {
  const { ref, reached } = useReached();
  const iconClass = cn('absolute size-6 transition-colors', sequencedTransition, reached ? 'text-lime' : 'text-line');

  return (
    <div
      ref={ref}
      aria-hidden
      style={{ '--sequence-delay': `${300 + index * STEP_DELAY_MS}ms` } as CSSProperties}
      className="relative flex h-12 shrink-0 items-center justify-center lg:h-auto lg:w-14"
    >
      <div className="absolute top-0 bottom-3 left-1/2 w-0.5 -translate-x-1/2 overflow-hidden bg-line lg:hidden">
        <div className={cn('h-full origin-top bg-lime transition-transform', sequencedTransition, reached ? 'scale-y-100' : 'scale-y-0')} />
      </div>
      <div className="absolute inset-x-0 top-1/2 right-3 hidden h-0.5 -translate-y-1/2 overflow-hidden bg-line lg:block">
        <div className={cn('h-full origin-left bg-lime transition-transform', sequencedTransition, reached ? 'scale-x-100' : 'scale-x-0')} />
      </div>
      <ChevronDown className={cn(iconClass, 'bottom-0 lg:hidden')} strokeWidth={3} />
      <ChevronRight className={cn(iconClass, 'top-1/2 right-0 hidden -translate-y-1/2 lg:block')} strokeWidth={3} />
    </div>
  );
}

export function ProcessSteps() {
  return (
    <div className="flex flex-col lg:flex-row">
      {steps.map((step, index) => (
        <Fragment key={step.title}>
          <Step index={index} title={step.title} text={step.text} />
          {index < steps.length - 1 && <Connector index={index} />}
        </Fragment>
      ))}
    </div>
  );
}
