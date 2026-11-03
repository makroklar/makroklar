'use client';

import { useEffect, useRef, type ElementType, type ReactNode, type RefObject } from 'react';
import styles from './FadeScroll.module.css';

type FadeScrollProps = {
  /** HTML-Element des Scroll-Containers, z. B. 'ul' für Listen oder 'nav' */
  as?: ElementType;
  className?: string;
  children: ReactNode;
  /** Optionaler Zugriff von außen auf den Scroll-Container */
  scrollRef?: RefObject<HTMLElement | null>;
  'aria-label'?: string;
};

/**
 * Waagerecht scrollbare Leiste, die an der Kante ausblendet, hinter der noch Inhalt liegt –
 * rechts, solange es weitergeht, und links, sobald schon gescrollt wurde.
 */
export function FadeScroll({ as: Tag = 'div', className, children, scrollRef, ...rest }: FadeScrollProps) {
  const ownRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ownRef.current;
    if (!el) return;
    if (scrollRef) scrollRef.current = el;

    // Attribute direkt setzen statt State, damit Scrollen kein Neu-Rendern auslöst
    const update = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      el.toggleAttribute('data-fade-start', el.scrollLeft > 1);
      el.toggleAttribute('data-fade-end', el.scrollLeft < maxScroll - 1);
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);

    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [scrollRef, children]);

  return (
    <Tag ref={ownRef} className={`${styles.scroller} ${className ?? ''}`} {...rest}>
      {children}
    </Tag>
  );
}
