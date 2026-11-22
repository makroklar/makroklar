'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowIcon } from '../ui/ArrowIcon';
import { onboardingSteps } from '../../data/onboardingSteps';
import styles from './OnboardingHeader.module.css';

export function OnboardingHeader() {
  const pathname = usePathname();
  const isConfirmation = pathname === '/business/onboarding/menu/pos/complete';
  const currentIndex = Math.max(
    0,
    onboardingSteps.findIndex(
      (step) => pathname === step.href || pathname.startsWith(`${step.href}/`),
    ),
  );
  const currentStep = currentIndex + 1;
  const totalSteps = onboardingSteps.length;
  const activeStep = onboardingSteps[currentIndex];
  const backHref =
    pathname !== activeStep.href
      ? activeStep.href
      : currentIndex === 0
        ? '/business/welcome'
        : onboardingSteps[currentIndex - 1].href;

  return (
    <header className={styles.header} data-confirmation={isConfirmation}>
      {!isConfirmation && (
        <Link className={`${styles.navigationLink} ${styles.backLink}`} href={backHref}>
          <ArrowIcon direction="left" />
          <span>Zurück</span>
        </Link>
      )}
      <div className={styles.progressGroup}>
        <p className={styles.progressLabel} id="onboarding-progress-label">
          Schritt {currentStep} von {totalSteps}.
        </p>
        <progress
          className={styles.progress}
          value={currentStep}
          max={totalSteps}
          aria-labelledby="onboarding-progress-label"
          aria-valuetext={`Schritt ${currentStep} von ${totalSteps}: ${activeStep.label}`}
        />
      </div>
      <Link
        className={`${styles.navigationLink} ${styles.cancelLink}`}
        href="/business/welcome"
      >
        Abbrechen
      </Link>
    </header>
  );
}
