'use client';

import type { ReactNode } from 'react';
import { m } from 'motion/react';

/** Blendet Inhalte beim Hineinscrollen ein. Ohne JavaScript greift die noscript-Regel im LandingLayout. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <m.div
      data-reveal
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, delay, ease: 'easeOut' }}
    >
      {children}
    </m.div>
  );
}
