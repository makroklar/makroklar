'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { primaryNavigation } from '../../content/navigation';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Logo } from './Logo';
import { MobileMenu } from './MobileMenu';
import { SectionLink } from './SectionLink';

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    const updateScrolled = () => setScrolled(window.scrollY > 12);
    updateScrolled();
    window.addEventListener('scroll', updateScrolled, { passive: true });
    return () => window.removeEventListener('scroll', updateScrolled);
  }, []);

  // Markiert den Abschnitt, der gerade in der Bildschirmmitte liegt
  useEffect(() => {
    setActiveSection(null);
    if (pathname !== '/') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
          else setActiveSection((current) => (current === entry.target.id ? null : current));
        });
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );

    primaryNavigation.forEach(({ section }) => {
      const element = section && document.getElementById(section);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [pathname]);

  // Fixed statt sticky: Das Schrumpfen verschiebt so nicht den Inhalt (sonst Flackern
  // durch Scroll-Korrektur). Der Platzhalter hält die Höhe des großen Headers frei.
  return (
    <>
    <div aria-hidden className="h-[72px] lg:h-[92px]" />
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 border-b transition-all duration-300',
        scrolled ? 'border-line bg-card/85 shadow-soft backdrop-blur-md' : 'border-transparent bg-card',
      )}
    >
      <div
        className={cn(
          'mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 transition-all duration-300 sm:px-8 xl:px-20',
          scrolled ? 'h-16' : 'h-[72px] lg:h-[92px]',
        )}
      >
        <Logo className="w-36 lg:w-[188px]" />

        <nav aria-label="Hauptnavigation" className="hidden items-center gap-8.5 lg:flex">
          {primaryNavigation.map((item) => {
            const active = item.section ? activeSection === item.section : pathname === item.href;
            return (
              <SectionLink
                key={item.href}
                href={item.href}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'relative py-1 text-sm no-underline transition-colors hover:text-brand',
                  'after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:rounded-full after:bg-lime after:transition-transform after:duration-300',
                  active ? 'font-medium text-brand after:scale-x-100' : 'text-black after:scale-x-0 hover:after:scale-x-100',
                )}
              >
                {item.label}
              </SectionLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-4.5">
          <Link href="/business" className="hidden text-sm font-bold text-brand no-underline hover:underline lg:block">
            Login
          </Link>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/kontakt">Kostenlos ausprobieren</Link>
          </Button>
          <MobileMenu />
        </div>
      </div>
    </header>
    </>
  );
}
