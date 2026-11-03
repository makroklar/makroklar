'use client';

import { ArrowIcon } from './components/ui/ArrowIcon';
import { ChoiceCard } from './components/ui/ChoiceCard';
import { foodSources } from './data/foodSources';
import { useBusinessDraft } from './state/BusinessDraftContext';
import styles from './PurchasesPage.module.css';

export function PurchasesPage() {
  const { selectedFoodSources, setSelectedFoodSources } = useBusinessDraft();

  return (
    <section aria-labelledby="food-sources-title">
      <header className={styles.intro}>
        <h1 className={styles.title} id="food-sources-title">
          Woher beziehst du deine Lebensmittel?
        </h1>
        <p className={styles.description} id="food-sources-help">
          Wähle alle Wege aus, die du nutzt. (Mehrfachauswahl möglich)
        </p>
      </header>
      <fieldset className={styles.options} aria-describedby="food-sources-help">
        <legend className={styles.visuallyHidden}>Bezugsquellen auswählen</legend>
        {foodSources.map((source) => (
          <ChoiceCard
            key={source.id}
            className={source.id === 'regional' ? undefined : styles.detailedCard}
            title={source.title}
            description={source.description}
            icon={source.icon}
            type="checkbox"
            name="foodSources"
            value={source.id}
            checked={selectedFoodSources.includes(source.id)}
            onCheckedChange={(checked) =>
              setSelectedFoodSources(
                checked
                  ? [...selectedFoodSources, source.id]
                  : selectedFoodSources.filter((id) => id !== source.id),
              )
            }
          />
        ))}
      </fieldset>
      <div className={styles.actions}>
        <button
          className={styles.continueButton}
          type="button"
          disabled
          title="Die nächsten Ansichten werden noch umgesetzt."
        >
          <span>Weiter</span>
          <ArrowIcon tone="inherit" />
        </button>
      </div>
    </section>
  );
}
