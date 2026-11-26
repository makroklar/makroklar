import type { CustomDishDraft } from '../types/recipe';

// Stable preview IDs make applying the same batch again harmless. Names may repeat.
export function appendCustomDishes(current: readonly CustomDishDraft[], incoming: readonly CustomDishDraft[]): CustomDishDraft[] {
  const known = new Set(current.map(dish => dish.id));
  const additions: CustomDishDraft[] = [];
  for (const dish of incoming) {
    if (known.has(dish.id)) continue;
    known.add(dish.id);
    additions.push({ ...dish });
  }
  return [...current, ...additions];
}
