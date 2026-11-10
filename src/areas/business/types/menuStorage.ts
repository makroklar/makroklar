import type { ImportedMenuItem } from './importedMenuItem';

export interface MenuSnapshot {
  accountKey: string;
  restaurantId: string | null;
  items: ImportedMenuItem[];
  error: string | null;
}

export type SaveMenuResult =
  | { status: 'saved'; items: ImportedMenuItem[] }
  | { status: 'error'; message: string };
