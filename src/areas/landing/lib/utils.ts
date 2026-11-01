import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-Klassen zusammenführen, spätere Klassen gewinnen */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
