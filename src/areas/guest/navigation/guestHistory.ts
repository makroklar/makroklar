'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Merkt sich die vorherige Seite der Gastansicht, solange innerhalb der App navigiert wird.
// Nach einem Neuladen oder beim direkten Aufruf ist sie leer
let currentPath: string | null = null;
let previousPath: string | null = null;

// Steht im GuestLayout, damit jede Navigation innerhalb der Gastansicht erfasst wird
export function GuestHistoryTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === currentPath) return;
    previousPath = currentPath;
    currentPath = pathname;
  }, [pathname]);

  return null;
}

export function getPreviousGuestPath() {
  return previousPath;
}
