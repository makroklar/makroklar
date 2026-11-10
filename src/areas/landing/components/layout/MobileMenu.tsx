'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { primaryNavigation } from '../../content/navigation';
import { Button } from '../ui/button';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '../ui/sheet';

export function MobileMenu() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Menü öffnen" className="lg:hidden">
          <Menu aria-hidden className="size-6" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="mt-2 mb-0 text-xl font-bold text-brand">Menü</SheetTitle>
        <SheetDescription className="sr-only">Navigation der Website</SheetDescription>
        <nav aria-label="Mobile Navigation" className="mt-8 flex flex-col gap-1">
          {primaryNavigation.map((item) => (
            <SheetClose asChild key={item.href}>
              <Link href={item.href} className="rounded-lg py-3 text-lg text-ink no-underline">
                {item.label}
              </Link>
            </SheetClose>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <SheetClose asChild>
            <Button asChild variant="ghost">
              <Link href="/business">Login</Link>
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button asChild>
              <Link href="/kontakt">Kostenlos ausprobieren</Link>
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
