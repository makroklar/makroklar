import type { ReactNode } from 'react';

/** Sichtbarer Platzhalter für Angaben, die das Team noch liefern muss – vor der Veröffentlichung ersetzen */
export function Todo({ children }: { children: ReactNode }) {
  return <mark className="rounded bg-lime-soft px-1 font-medium text-brand">[{children}]</mark>;
}
