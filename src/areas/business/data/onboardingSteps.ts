export type OnboardingStepId = 'menu' | 'purchases' | 'bases' | 'dishes';

export interface OnboardingStep {
  id: OnboardingStepId;
  label: string;
  href: string;
}

export const onboardingSteps: readonly OnboardingStep[] = [
  {
    id: 'menu',
    label: 'Speisekarte hinzufügen',
    href: '/business/onboarding/menu',
  },
  {
    id: 'purchases',
    label: 'Einkäufe hinzufügen',
    href: '/business/onboarding/purchases',
  },
  {
    id: 'bases',
    label: 'Basisrezepte erstellen',
    href: '/business/onboarding/bases',
  },
  {
    id: 'dishes',
    label: 'Gerichte vervollständigen',
    href: '/business/onboarding/dishes',
  },
];
