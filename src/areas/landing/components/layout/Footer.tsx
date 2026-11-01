import Link from 'next/link';
import { footerNavigation } from '../../content/navigation';
import { Logo } from './Logo';

export function Footer() {
  return (
    <footer className="bg-card">
      <div className="mx-auto max-w-[1440px] px-4 pt-12 pb-9 sm:px-8 lg:pt-15.5 xl:px-24">
        <div className="grid gap-10 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
          <div className="sm:col-span-3 lg:col-span-1">
            <Logo className="w-[188px]" />
            <p className="mt-3 mb-0 max-w-[270px] text-[13px]/[21px] text-ink">
              Automatische Nährwert-Transparenz für Gastronomie, die ihren Gästen Sicherheit geben möchte.
            </p>
          </div>

          {footerNavigation.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="mb-3 text-sm font-bold text-ink">{group.title}</h2>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-[13px] text-brand no-underline hover:underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between lg:mt-20">
          <p className="m-0 text-ink-subtle">© {new Date().getFullYear()} makroklar.</p>
          <p className="m-0 text-ink">Nährwerte verständlich. Entscheidungen sicherer.</p>
        </div>
      </div>
    </footer>
  );
}
