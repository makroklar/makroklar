import styles from './DishesSetupPage.module.css';

// Temporary destination until the dish editor is designed. No initialization or save yet.
export function DishesSetupPage() {
  return (
    <section className={styles.intro} aria-labelledby="dishes-setup-title">
      <h1 className={styles.title} id="dishes-setup-title">Füge deine Gerichte hinzu.</h1>
      <p className={styles.description}>
        Hier wirst du deine Gerichte mit deinen Lebensmitteln verknüpfen können.
        Die Bearbeitung ist noch nicht verfügbar.
      </p>
    </section>
  );
}
