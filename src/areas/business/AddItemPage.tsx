import Link from 'next/link';
import ui from './components/dashboard/Dashboard.module.css';
import styles from './AddItemPage.module.css';

// „Was möchtest du hinzufügen?“ – Ziel des Plus-Buttons in der Seitenleiste
export function AddItemPage() {
  return (
    <div className={ui.page}>
      <h1 className={ui.title}>Was möchtest du hinzufügen?</h1>
      <ul className={styles.options}>
        <li>
          <Link className={styles.option} href="/business/neu/gericht">
            <strong>Neues Gericht</strong>
            <span>Das fertige Endprodukt für deine Speisekarte.</span>
          </Link>
        </li>
        <li>
          <Link className={styles.option} href="/business/neu/basis">
            <strong>Neue Basis</strong>
            <span>Grundkomponenten für deine Gerichte (z. B. Soßen oder Teige)</span>
            <em className={styles.soon}>Wird noch nicht gespeichert</em>
          </Link>
        </li>
        <li>
          {/* In Figma noch ohne Ziel – nutzt die Lebensmittel-Eingabe aus dem Onboarding */}
          <Link className={styles.option} href="/business/neu/produkt">
            <strong>Neues Produkt</strong>
            <span>Neue Ware oder rohe Zutaten ins System einpflegen.</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
