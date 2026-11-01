import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Reveal } from './Reveal';

export function SectionHeading({
  title,
  children,
  inverted,
}: {
  title: string;
  children: ReactNode;
  inverted?: boolean;
}) {
  return (
    <Reveal className="mx-auto max-w-[820px] text-center">
      <h2
        className={cn(
          'mb-2.5 text-[28px]/[36px] font-bold sm:text-4xl/[46px]',
          inverted ? 'text-white' : 'text-brand',
        )}
      >
        {title}
      </h2>
      <p className={cn('m-0 text-base/[25px]', inverted ? 'font-medium text-lime' : 'text-ink')}>{children}</p>
    </Reveal>
  );
}
