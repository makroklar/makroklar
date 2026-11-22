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
import type { CustomDishDraft, RecipeDraft } from '../types/recipe';
import type { OnboardingRead } from '../data/readOnboarding';
import type { CompletionSummary } from '../data/onboardingModel';

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
  customDishes: readonly CustomDishDraft[];
  addCustomDish: (dish: CustomDishDraft) => void;
  recipes: Readonly<Record<string, RecipeDraft>>;
  setRecipe: (dishId: string, recipe: RecipeDraft) => void;
  selectedDishId: string | null;
  setSelectedDishId: (id: string | null) => void;
  onboardingVersion: number;
  onboardingError: string | null;
  acceptInitialization: (summary: CompletionSummary) => void;
}

const BusinessDraftContext = createContext<BusinessDraftValue | null>(null);

export function BusinessDraftProvider({ children, snapshot, onboarding }: { children: ReactNode; snapshot: MenuSnapshot; onboarding: OnboardingRead }) {
  const [serverItems, setServerItems] = useState(snapshot.items);
  const [importedItems, setImportedItems] = useState<ImportedMenuItem[]>(() => mergeImportedItems([], snapshot.items));
  const [selectedFoodSources, setSelectedFoodSources] = useState<FoodSourceId[]>([]);
  const [manualFoods, setManualFoods] = useState<ManualFoodDraft[]>(onboarding.snapshot?.manualFoods ?? []);
  const [catalogFoods, setCatalogFoods] = useState<CatalogFood[]>(onboarding.snapshot?.catalogFoods ?? []);
  const [customDishes, setCustomDishes] = useState<CustomDishDraft[]>(onboarding.snapshot?.customDishes ?? []);
  const [recipes, setRecipes] = useState<Record<string, RecipeDraft>>(onboarding.snapshot?.recipes ?? {});
  const [onboardingVersion, setOnboardingVersion] = useState(onboarding.snapshot?.version ?? 0);
  const [serverOnboarding, setServerOnboarding] = useState(onboarding.snapshot);
  const [dirty, setDirty] = useState(false);
  const [selectedDishId, setSelectedDishId] = useState<string | null>(null);
  if (serverOnboarding !== onboarding.snapshot) {
    setServerOnboarding(onboarding.snapshot);
    // A refresh must never discard unsaved ingredient/recipe edits.
    if (onboarding.snapshot && !dirty) {
      setManualFoods(onboarding.snapshot.manualFoods);
      setCatalogFoods(onboarding.snapshot.catalogFoods);
      setCustomDishes(onboarding.snapshot.customDishes);
      setRecipes(onboarding.snapshot.recipes);
      setOnboardingVersion(onboarding.snapshot.version);
    }
  }
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
    setCustomDishes([]);
    setRecipes({});
    setSelectedDishId(null);
    setDirty(false);
  }, []);
  const addManualFood = useCallback((food: ManualFoodDraft) => {
    setDirty(true);
    setManualFoods(current => [...current, { ...food }]);
  }, []);
  const removeManualFood = useCallback((id: string) => {
    setDirty(true);
    setManualFoods(current => current.filter(food => food.id !== id));
  }, []);
  const addCatalogFood = useCallback((food: CatalogFood) => {
    setDirty(true);
    setCatalogFoods(current => appendCatalogFood(current, food));
  }, []);
  const removeCatalogFood = useCallback((id: string) => {
    setDirty(true);
    setCatalogFoods(current => current.filter(food => food.id !== id));
  }, []);
  const addCustomDish = useCallback((dish: CustomDishDraft) => {
    setDirty(true);
    setCustomDishes(current => current.some(item => item.id === dish.id) ? current : [...current, { ...dish }]);
    setSelectedDishId(`manual-${dish.id}`);
  }, []);
  const setRecipe = useCallback((dishId: string, recipe: RecipeDraft) => {
    setDirty(true);
    setRecipes(current => ({ ...current, [dishId]: { ...recipe, ingredients: recipe.ingredients.map(line => ({ ...line })) } }));
  }, []);
  const acceptInitialization = useCallback((summary: CompletionSummary) => {
    setOnboardingVersion(summary.version);
    setDirty(false);
  }, []);
  const value = useMemo(
    () => ({ importedItems, acceptItems, selectedFoodSources, setSelectedFoodSources, resetDraft,
      storageError: snapshot.error, canSaveItems: snapshot.restaurantId !== null && snapshot.error === null,
      manualFoods, addManualFood, removeManualFood, catalogFoods, addCatalogFood, removeCatalogFood,
      customDishes, addCustomDish, recipes, setRecipe, selectedDishId, setSelectedDishId,
      onboardingVersion, onboardingError: onboarding.error, acceptInitialization }),
    [importedItems, acceptItems, selectedFoodSources, resetDraft, snapshot.error, snapshot.restaurantId,
      manualFoods, addManualFood, removeManualFood, catalogFoods, addCatalogFood, removeCatalogFood,
      customDishes, addCustomDish, recipes, setRecipe, selectedDishId, onboardingVersion, onboarding.error, acceptInitialization],
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
