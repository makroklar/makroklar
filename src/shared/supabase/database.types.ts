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
      // Prepared migration 20261111000100; regenerate database.generated.ts after application.
      read_restaurant_onboarding: { Args: { target_restaurant_id: string }; Returns: import('./database.generated').Json };
      read_saved_off_product: { Args: { barcode: string }; Returns: import('./database.generated').Json };
      save_restaurant_onboarding: { Args: { target_restaurant_id: string; payload: import('./database.generated').Json; base_version: number; request_id: string }; Returns: import('./database.generated').Json };
      get_dish_nutrition: Omit<GeneratedNutrition, 'Returns'> & {
        Returns: DishNutritionRow[];
      };
    };
  };
};
