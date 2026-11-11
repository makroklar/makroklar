'use client';

import type { ComponentProps, MouseEvent } from 'react';
import Link from 'next/link';

/** Wartet, bis ein offenes Menü (Radix-Scroll-Sperre am body) geschlossen ist */
function whenScrollUnlocked(callback: () => void) {
  if (!document.body.hasAttribute('data-scroll-locked')) return callback();
  const observer = new MutationObserver(() => {
    if (document.body.hasAttribute('data-scroll-locked')) return;
    observer.disconnect();
    callback();
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-scroll-locked'] });
}

/**
 * Link auf einen Abschnitt der Startseite (z. B. "/#ablauf").
 * Next.js scrollt nicht erneut, wenn der Hash schon in der Adresse steht.
 * Auf der Startseite scrollen wir deshalb selbst, auf anderen Seiten navigiert der Link normal.
 */
export function SectionLink({ href, onClick, ...props }: ComponentProps<typeof Link> & { href: string }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    const [path, hash] = href.split('#');
    if (event.defaultPrevented || !hash || window.location.pathname !== (path || '/')) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = document.getElementById(hash);
    if (!target) return;

    event.preventDefault();
    history.replaceState(history.state, '', `#${hash}`);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    whenScrollUnlocked(() => target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }));
  }

  return <Link href={href} onClick={handleClick} {...props} />;
}
