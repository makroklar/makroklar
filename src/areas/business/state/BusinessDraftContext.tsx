'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ImportedMenuItem } from '../types/importedMenuItem';
import type { FoodSourceId } from '../types/foodSource';
import { mergeImportedItems } from './businessDraft';
import { appendCustomDishes } from './customDishes';
import type { MenuSnapshot } from '../types/menuStorage';
import type { ManualFoodDraft } from '../types/manualFood';
import type { CatalogFood } from '../types/catalogFood';
import { appendCatalogFood } from '../data/foodSearchModel';
import type { CustomDishDraft, RecipeDraft } from '../types/recipe';
import type { OnboardingRead } from '../data/readOnboarding';
import type { CompletionSummary } from '../data/onboardingModel';
import type { BasisRecipeDraft, BasisOnboardingPayload } from '../data/basisOnboardingModel';
import { basisDraftReducer, createBasisDraft, type DishBasisLine } from './basisDraft';
import { buildFoodUsageIndex, removeUnusedFood, type FoodUsageIndex } from './foodUsage';

// Raw UI values are acknowledged only after the action validates and saves them.
type OnboardingSubmission = Omit<BasisOnboardingPayload, 'manualFoods'> & { manualFoods: ManualFoodDraft[] };

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
  foodUsages: FoodUsageIndex;
  canRemoveFoods: boolean;
  customDishes: readonly CustomDishDraft[];
  addCustomDish: (dish: CustomDishDraft) => void;
  addCustomDishes: (dishes: readonly CustomDishDraft[]) => void;
  recipes: Readonly<Record<string, RecipeDraft>>;
  setRecipe: (dishId: string, recipe: RecipeDraft) => void;
  basisRecipes: readonly BasisRecipeDraft[];
  upsertBasisRecipe: (recipe: BasisRecipeDraft) => void;
  removeBasisRecipe: (id: string) => void;
  dishBases: Readonly<Record<string, readonly DishBasisLine[]>>;
  setDishBases: (dishKey: string, lines: readonly DishBasisLine[]) => void;
  deletedBasisIds: readonly string[];
  basisError: string | null;
  clearBasisError: () => void;
  selectedDishId: string | null;
  setSelectedDishId: (id: string | null) => void;
  selectedBasisId: string | null;
  setSelectedBasisId: (id: string | null) => void;
  onboardingVersion: number;
  onboardingError: string | null;
  savedSummary: CompletionSummary | null;
  hasUnsavedChanges: boolean;
  basisPersistenceReady: boolean;
  acceptInitialization: (summary: CompletionSummary, submitted: OnboardingSubmission) => void;
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
  const [basisDraft, dispatchBasis] = useReducer(basisDraftReducer, onboarding.snapshot, createBasisDraft);
  const [onboardingVersion, setOnboardingVersion] = useState(onboarding.snapshot?.version ?? 0);
  const [savedSummary, setSavedSummary] = useState<CompletionSummary | null>(onboarding.snapshot?.summary ?? null);
  const [serverOnboarding, setServerOnboarding] = useState(onboarding.snapshot);
  const [dirty, setDirty] = useState(false);
  const [selectedDishId, setSelectedDishId] = useState<string | null>(null);
  const [selectedBasisId, setSelectedBasisId] = useState<string | null>(null);
  const foodUsages = useMemo(() => buildFoodUsageIndex({ recipes, basisRecipes: basisDraft.basisRecipes, importedItems, customDishes }),
    [recipes, basisDraft.basisRecipes, importedItems, customDishes]);
  const canRemoveFoods = onboarding.snapshot !== null && !onboarding.error && !snapshot.error;
  const latestContents = useRef({ manualFoods, catalogFoods, customDishes, recipes });
  latestContents.current = { manualFoods, catalogFoods, customDishes, recipes };
  const basisPersistenceReady = !onboarding.error && onboarding.snapshot !== null
    && 'schemaVersion' in onboarding.snapshot && onboarding.snapshot.schemaVersion === 2;
  if (serverOnboarding !== onboarding.snapshot) {
    setServerOnboarding(onboarding.snapshot);
    // A refresh must never discard unsaved ingredient/recipe edits.
    if (onboarding.snapshot && onboarding.snapshot.version >= onboardingVersion && !dirty && !basisDraft.dirty) {
      setManualFoods(onboarding.snapshot.manualFoods);
      setCatalogFoods(onboarding.snapshot.catalogFoods);
      setCustomDishes(onboarding.snapshot.customDishes);
      setRecipes(onboarding.snapshot.recipes);
      dispatchBasis({ type: 'restore', snapshot: onboarding.snapshot });
      setOnboardingVersion(onboarding.snapshot.version);
      setSavedSummary(onboarding.snapshot.summary);
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
    dispatchBasis({ type: 'reset' });
    setSelectedDishId(null);
    setSelectedBasisId(null);
    setDirty(false);
    setSavedSummary(null);
  }, []);
  const addManualFood = useCallback((food: ManualFoodDraft) => {
    setDirty(true);
    setManualFoods(current => [...current, { ...food }]);
  }, []);
  const removeManualFood = useCallback((id: string) => {
    const next = removeUnusedFood(manualFoods, id, foodUsages, canRemoveFoods);
    if (next === manualFoods) return;
    setDirty(true);
    setManualFoods(next);
  }, [manualFoods, foodUsages, canRemoveFoods]);
  const addCatalogFood = useCallback((food: CatalogFood) => {
    setDirty(true);
    setCatalogFoods(current => appendCatalogFood(current, food));
  }, []);
  const removeCatalogFood = useCallback((id: string) => {
    const next = removeUnusedFood(catalogFoods, id, foodUsages, canRemoveFoods);
    if (next === catalogFoods) return;
    setDirty(true);
    setCatalogFoods(next);
  }, [catalogFoods, foodUsages, canRemoveFoods]);
  const addCustomDishes = useCallback((dishes: readonly CustomDishDraft[]) => {
    if (dishes.length === 0) return;
    setDirty(true);
    setCustomDishes(current => appendCustomDishes(current, dishes));
    setSelectedDishId(`manual-${dishes[dishes.length - 1].id}`);
  }, []);
  const addCustomDish = useCallback((dish: CustomDishDraft) => addCustomDishes([dish]), [addCustomDishes]);
  const setRecipe = useCallback((dishId: string, recipe: RecipeDraft) => {
    setDirty(true);
    setRecipes(current => ({ ...current, [dishId]: { ...recipe, ingredients: recipe.ingredients.map(line => ({ ...line })) } }));
  }, []);
  const upsertBasisRecipe = useCallback((recipe: BasisRecipeDraft) => {
    dispatchBasis({ type: 'upsert', recipe });
  }, []);
  const removeBasisRecipe = useCallback((id: string) => {
    dispatchBasis({ type: 'remove', id });
  }, []);
  const setDishBases = useCallback((dishKey: string, lines: readonly DishBasisLine[]) => {
    dispatchBasis({ type: 'setLinks', dishKey, lines, knownDishKeys: [
      ...importedItems.map(item => `lightspeed-k-series-${item.sourceId}`),
      ...customDishes.map(dish => `manual-${dish.id}`),
    ] });
  }, [importedItems, customDishes]);
  const clearBasisError = useCallback(() => dispatchBasis({ type: 'clearError' }), []);
  const acceptInitialization = useCallback((summary: CompletionSummary, submitted: OnboardingSubmission) => {
    setOnboardingVersion(summary.version);
    setSavedSummary(summary);
    const { manualFoods, catalogFoods, customDishes, recipes } = submitted;
    // A late response must not mark edits made during the request as saved.
    setDirty(JSON.stringify(latestContents.current) !== JSON.stringify({ manualFoods, catalogFoods, customDishes, recipes }));
    dispatchBasis({ type: 'acknowledge', submitted });
  }, []);
  const value = useMemo(
    () => ({ importedItems, acceptItems, selectedFoodSources, setSelectedFoodSources, resetDraft,
      storageError: snapshot.error, canSaveItems: snapshot.restaurantId !== null && snapshot.error === null,
      manualFoods, addManualFood, removeManualFood, catalogFoods, addCatalogFood, removeCatalogFood,
      foodUsages, canRemoveFoods, selectedBasisId, setSelectedBasisId,
      customDishes, addCustomDish, addCustomDishes, recipes, setRecipe, selectedDishId, setSelectedDishId,
      basisRecipes: basisDraft.basisRecipes, upsertBasisRecipe, removeBasisRecipe,
      dishBases: basisDraft.dishBases, setDishBases, deletedBasisIds: basisDraft.deletedBasisIds,
      basisError: basisDraft.error, clearBasisError,
      onboardingVersion, onboardingError: onboarding.error, basisPersistenceReady, acceptInitialization,
      savedSummary, hasUnsavedChanges: dirty || basisDraft.dirty }),
    [importedItems, acceptItems, selectedFoodSources, resetDraft, snapshot.error, snapshot.restaurantId,
      manualFoods, addManualFood, removeManualFood, catalogFoods, addCatalogFood, removeCatalogFood,
      foodUsages, canRemoveFoods, selectedBasisId,
      customDishes, addCustomDish, addCustomDishes, recipes, setRecipe, selectedDishId, onboardingVersion, onboarding.error, acceptInitialization,
      basisDraft, upsertBasisRecipe, removeBasisRecipe, setDishBases, clearBasisError, basisPersistenceReady, savedSummary, dirty],
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
