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
import type { FoodSourceId } from '../types/foodSource';
import { mergeImportedItems } from './businessDraft';
import type { MenuSnapshot } from '../types/menuStorage';
import type { ManualFoodDraft } from '../types/manualFood';
import type { CatalogFood } from '../types/catalogFood';
import { appendCatalogFood } from '../data/foodSearchModel';

interface BusinessDraftValue {
  importedItems: readonly ImportedMenuItem[];
  acceptItems: (items: readonly ImportedMenuItem[]) => void;
  selectedFoodSources: readonly FoodSourceId[];
  setSelectedFoodSources: (sources: FoodSourceId[]) => void;
  resetDraft: () => void;
  storageError: string | null;
  canSaveItems: boolean;
  manualFoods: readonly ManualFoodDraft[];
  addManualFood: (food: ManualFoodDraft) => void;
  removeManualFood: (id: string) => void;
  catalogFoods: readonly CatalogFood[];
  addCatalogFood: (food: CatalogFood) => void;
  removeCatalogFood: (id: string) => void;
}

const BusinessDraftContext = createContext<BusinessDraftValue | null>(null);

export function BusinessDraftProvider({ children, snapshot }: { children: ReactNode; snapshot: MenuSnapshot }) {
  const [serverItems, setServerItems] = useState(snapshot.items);
  const [importedItems, setImportedItems] = useState<ImportedMenuItem[]>(() => mergeImportedItems([], snapshot.items));
  const [selectedFoodSources, setSelectedFoodSources] = useState<FoodSourceId[]>([]);
  const [manualFoods, setManualFoods] = useState<ManualFoodDraft[]>([]);
  const [catalogFoods, setCatalogFoods] = useState<CatalogFood[]>([]);
  // Adopt refreshed server data before descendants render, keeping temporary food-source choices.
  if (serverItems !== snapshot.items) {
    setServerItems(snapshot.items);
    if (!snapshot.error) setImportedItems(mergeImportedItems([], snapshot.items));
  }
  const acceptItems = useCallback((items: readonly ImportedMenuItem[]) => {
    setImportedItems((current) => mergeImportedItems(current, items));
  }, []);
  const resetDraft = useCallback(() => {
    setImportedItems([]);
    setSelectedFoodSources([]);
    setManualFoods([]);
    setCatalogFoods([]);
  }, []);
  const addManualFood = useCallback((food: ManualFoodDraft) => {
    setManualFoods(current => [...current, { ...food }]);
  }, []);
  const removeManualFood = useCallback((id: string) => {
    setManualFoods(current => current.filter(food => food.id !== id));
  }, []);
  const addCatalogFood = useCallback((food: CatalogFood) => {
    setCatalogFoods(current => appendCatalogFood(current, food));
  }, []);
  const removeCatalogFood = useCallback((id: string) => {
    setCatalogFoods(current => current.filter(food => food.id !== id));
  }, []);
  const value = useMemo(
    () => ({ importedItems, acceptItems, selectedFoodSources, setSelectedFoodSources, resetDraft,
      storageError: snapshot.error, canSaveItems: snapshot.restaurantId !== null && snapshot.error === null,
      manualFoods, addManualFood, removeManualFood, catalogFoods, addCatalogFood, removeCatalogFood }),
    [importedItems, acceptItems, selectedFoodSources, resetDraft, snapshot.error, snapshot.restaurantId,
      manualFoods, addManualFood, removeManualFood, catalogFoods, addCatalogFood, removeCatalogFood],
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
