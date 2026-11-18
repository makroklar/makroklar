export interface CustomDishDraft {
  id: string;
  name: string;
  price: number | null;
}

export interface RecipeLineDraft {
  foodId: string;
  quantity: string;
  unit: 'g' | 'ml' | '';
}

export interface RecipeDraft {
  servings: string;
  ingredients: RecipeLineDraft[];
}

export interface RecipeFood {
  id: string;
  name: string;
  basis: '100g' | '100ml' | null;
  preparation: 'as_sold' | 'prepared' | null;
  sourceLabel: string;
}
