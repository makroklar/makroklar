export interface ManualFood {
  name: string;
  basis: '100g' | '100ml';
  preparation: 'as_sold' | 'prepared';
  sourceKind: 'label' | 'supplier';
  sourceDescription: string;
  energyKcal: number;
  proteinG: number;
  fatG: number;
  carbohydrateG: number;
}

// Client draft only. A future save action must verify consent and record the user/time on the server.
export interface ManualFoodDraft extends ManualFood {
  id: string;
  noticeVersion: string;
}
