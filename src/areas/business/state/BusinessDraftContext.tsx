'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ImportedMenuItem } from '../types/importedMenuItem';
import { mergeImportedItems } from './businessDraft';

interface BusinessDraftValue {
  importedItems: readonly ImportedMenuItem[];
  acceptItems: (items: readonly ImportedMenuItem[]) => void;
  resetDraft: () => void;
}

const BusinessDraftContext = createContext<BusinessDraftValue | null>(null);

export function BusinessDraftProvider({ children }: { children: ReactNode }) {
  const [importedItems, setImportedItems] = useState<ImportedMenuItem[]>([]);
  const acceptItems = useCallback((items: readonly ImportedMenuItem[]) => {
    setImportedItems((current) => mergeImportedItems(current, items));
  }, []);
  const resetDraft = useCallback(() => setImportedItems([]), []);
  const value = useMemo(
    () => ({ importedItems, acceptItems, resetDraft }),
    [importedItems, acceptItems, resetDraft],
  );

  return (
    <BusinessDraftContext.Provider value={value}>
      {children}
    </BusinessDraftContext.Provider>
  );
}

export function useBusinessDraft(): BusinessDraftValue {
  const draft = useContext(BusinessDraftContext);
  if (draft === null) {
    throw new Error('useBusinessDraft must be used inside BusinessDraftProvider.');
  }
  return draft;
}
