import type { Database as GeneratedDatabase } from './database.generated';

export type { Json } from './database.generated';

type GeneratedNutrition = GeneratedDatabase['public']['Functions']['get_dish_nutrition'];
type NutritionFields = Omit<
  GeneratedNutrition['Returns'][number],
  'recipe_total' | 'per_serving' | 'status'
>;

// Function introspection cannot infer NULLs returned by SQL CASE expressions.
export type DishNutritionRow = NutritionFields & (
  | { status: 'complete'; recipe_total: number; per_serving: number }
  | { status: 'incomplete' | 'empty_recipe'; recipe_total: null; per_serving: null }
);

// Preserve generated table relationships and metadata; correct this RPC contract only.
export type Database = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<GeneratedDatabase['public'], 'Functions'> & {
    Functions: Omit<GeneratedDatabase['public']['Functions'], 'get_dish_nutrition'> & {
      get_dish_nutrition: Omit<GeneratedNutrition, 'Returns'> & {
        Returns: DishNutritionRow[];
      };
    };
  };
};
