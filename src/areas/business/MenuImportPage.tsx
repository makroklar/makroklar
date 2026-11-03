import { ChoiceCard } from './components/ui/ChoiceCard';
import { menuImportOptions } from './data/menuImportOptions';
import styles from './MenuImportPage.module.css';

export function MenuImportPage() {
  return (
    <section className={styles.step} aria-labelledby="menu-import-title">
      <header className={styles.intro}>
        <h1 className={styles.title} id="menu-import-title">
          Lass uns deine Speisekarte importieren.
        </h1>
        <p className={styles.description}>
          Wähle einen Weg, um deine Gerichte in das System zu übertragen.
        </p>
      </header>
      <fieldset className={styles.options}>
        <legend className={styles.visuallyHidden}>Importmethode wählen</legend>
        {menuImportOptions.map((option) =>
          option.href ? (
            <ChoiceCard
              key={option.id}
              title={option.title}
              description={option.description}
              icon={option.icon}
              href={option.href}
            />
          ) : (
            <ChoiceCard
              key={option.id}
              title={option.title}
              description={option.description}
              icon={option.icon}
              name="menuImportMethod"
              value={option.id}
            />
          ),
        )}
      </fieldset>
    </section>
  );
}
