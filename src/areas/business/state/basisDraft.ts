import type { BasisOnboardingSnapshot, BasisRecipeDraft, BasisOnboardingPayload } from '../data/basisOnboardingModel';
import type { OnboardingSnapshot } from '../data/onboardingModel';

export type DishBasisLine = BasisOnboardingPayload['dishBases'][string][number];
type Snapshot = OnboardingSnapshot | BasisOnboardingSnapshot | null;

export interface BasisDraftState {
  basisRecipes: BasisRecipeDraft[];
  dishBases: Record<string, DishBasisLine[]>;
  deletedBasisIds: string[];
  savedBasisIds: string[];
  dirty: boolean;
  error: string | null;
  fromV2: boolean;
}

export type BasisDraftAction =
  | { type: 'upsert'; recipe: BasisRecipeDraft }
  | { type: 'remove'; id: string }
  | { type: 'setLinks'; dishKey: string; lines: readonly DishBasisLine[]; knownDishKeys: readonly string[] }
  | { type: 'restore'; snapshot: Snapshot }
  | { type: 'acknowledge'; submitted: Pick<BasisOnboardingPayload, 'basisRecipes' | 'dishBases' | 'deletedBasisIds'> }
  | { type: 'clearError' }
  | { type: 'reset' };

export function createBasisDraft(snapshot: Snapshot = null): BasisDraftState {
  const saved = snapshot && 'schemaVersion' in snapshot && snapshot.schemaVersion === 2 ? snapshot : null;
  return {
    basisRecipes: structuredClone(saved?.basisRecipes ?? []),
    dishBases: structuredClone(saved?.dishBases ?? {}),
    deletedBasisIds: [], savedBasisIds: saved?.basisRecipes.map(recipe => recipe.id) ?? [],
    dirty: false, error: null, fromV2: saved !== null,
  };
}

export function basisUsedBy(state: BasisDraftState, id: string): string[] {
  return Object.entries(state.dishBases).filter(([, lines]) => lines.some(line => line.basisId === id)).map(([key]) => key);
}

export function basisDraftReducer(state: BasisDraftState, action: BasisDraftAction): BasisDraftState {
  switch (action.type) {
    case 'acknowledge': {
      const { basisRecipes, dishBases, deletedBasisIds } = action.submitted;
      const unchanged = JSON.stringify([state.basisRecipes, state.dishBases, state.deletedBasisIds])
        === JSON.stringify([basisRecipes, dishBases, deletedBasisIds]);
      const savedBasisIds = basisRecipes.map(recipe => recipe.id);
      return { ...state, savedBasisIds, fromV2: true, dirty: !unchanged,
        // A basis removed while saving is now persisted and still needs explicit deletion.
        deletedBasisIds: [...new Set([
          ...state.deletedBasisIds.filter(id => !deletedBasisIds.includes(id)),
          ...savedBasisIds.filter(id => !state.basisRecipes.some(recipe => recipe.id === id)),
        ])] };
    }
    case 'restore':
      // Background refreshes cannot erase work, pending deletions or unsaved links.
      return state.dirty ? state : createBasisDraft(action.snapshot);
    case 'reset': return createBasisDraft(); // Logout: local only, never queues database deletion.
    case 'clearError': return { ...state, error: null };
    case 'upsert': {
      const recipe = action.recipe;
      const incompatible = Object.values(state.dishBases).some(lines => lines.some(line =>
        line.basisId === recipe.id && line.unit !== recipe.outputUnit));
      if (incompatible) return { ...state, error: 'Dieses Basisrezept wird bereits verwendet. Entferne zuerst die Verknüpfungen, bevor du die Einheit änderst.' };
      const copy = structuredClone(recipe);
      return {
        ...state,
        basisRecipes: state.basisRecipes.some(item => item.id === recipe.id)
          ? state.basisRecipes.map(item => item.id === recipe.id ? copy : item) : [...state.basisRecipes, copy],
        deletedBasisIds: state.deletedBasisIds.filter(id => id !== recipe.id), dirty: true, error: null,
      };
    }
    case 'remove': {
      const uses = basisUsedBy(state, action.id);
      if (uses.length) return { ...state, error: `Dieses Basisrezept wird in ${uses.length} Gericht(en) verwendet. Entferne zuerst die Verknüpfungen.` };
      if (!state.basisRecipes.some(recipe => recipe.id === action.id)) return state;
      return {
        ...state, basisRecipes: state.basisRecipes.filter(recipe => recipe.id !== action.id),
        deletedBasisIds: state.savedBasisIds.includes(action.id)
          ? [...new Set([...state.deletedBasisIds, action.id])] : state.deletedBasisIds,
        dirty: true, error: null,
      };
    }
    case 'setLinks': {
      const bases = new Map(state.basisRecipes.map(recipe => [recipe.id, recipe]));
      if (!action.knownDishKeys.includes(action.dishKey)
        || new Set(action.lines.map(line => line.basisId)).size !== action.lines.length
        || action.lines.some(line => !bases.has(line.basisId) || bases.get(line.basisId)?.outputUnit !== line.unit)) {
        return { ...state, error: 'Bitte prüfe Gericht, Basisrezepte und Einheiten. Jede Basis darf nur einmal zugeordnet werden.' };
      }
      return { ...state, dishBases: { ...state.dishBases, [action.dishKey]: action.lines.map(line => ({ ...line })) }, dirty: true, error: null };
    }
  }
}
