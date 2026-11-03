export type OnboardingStepId = 'menu' | 'purchases' | 'dishes';

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
    id: 'dishes',
    label: 'Gerichte hinzufügen',
    href: '/business/onboarding/dishes',
  },
];
