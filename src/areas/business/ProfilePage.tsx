import { ArrowRight } from 'lucide-react';
import { PageHeader } from './components/dashboard/PageHeader';
import { LogoutButton } from './components/auth/LogoutButton';
import { createClient } from '@/shared/supabase/server';
import { getRestaurantData } from './data/restaurantData';
import ui from './components/dashboard/Dashboard.module.css';
import styles from './ProfilePage.module.css';

interface SettingRow {
  title: string;
  detail: string;
  badge?: 'connected' | 'active' | 'soon';
}

function SettingsList({ rows }: { rows: SettingRow[] }) {
  return (
    <ul className={ui.list}>
      {rows.map(row => (
        <li key={row.title} className={ui.row}>
          <span className={ui.rowText}>
            <span className={ui.rowTitle}>{row.title}</span>
            <span className={ui.rowMeta}>{row.detail}</span>
          </span>
          <span className={ui.rowEnd}>
            {row.badge === 'connected' && <span className={styles.connected}>Verbunden</span>}
            {row.badge === 'active' && <span className={styles.active}>Aktiv</span>}
            {row.badge === 'soon' ? <span className={ui.badge}>Folgt bald</span> : <ArrowRight aria-hidden="true" size={18} />}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Profil & Einstellungen: Anzeige der gespeicherten Daten, Bearbeiten folgt später
export async function ProfilePage() {
  const [{ restaurantName, importedCount, foods }, user] = await Promise.all([
    getRestaurantData(),
    createClient().then(client => client.auth.getUser()).then(result => result.data.user).catch(() => null),
  ]);

  return (
    <div className={ui.page}>
      <PageHeader
        title="Profil & Einstellungen"
        subtitle={`Betriebsdaten, Schnittstellen und Team-Zugänge der ${restaurantName}.`}
        actions={<LogoutButton />}
      />

      <div className={styles.columns}>
        <div className={styles.column}>
          <section className={`${ui.card} ${ui.cardBordered}`} aria-labelledby="restaurant-title">
            <h2 id="restaurant-title" className={ui.cardTitle}>Restaurantdaten</h2>
            <SettingsList rows={[
              { title: restaurantName, detail: 'Name aus deiner Registrierung' },
              { title: 'Adresse und Website', detail: 'Noch nicht hinterlegt', badge: 'soon' },
              { title: 'Standardsprache', detail: 'Deutsch' },
            ]} />
            <button className={`${ui.secondaryButton} ${ui.small} ${styles.action}`} type="button" disabled title="Folgt bald">
              Restaurantdaten bearbeiten
            </button>
          </section>

          <section className={`${ui.card} ${ui.cardBordered}`} aria-labelledby="team-title">
            <h2 id="team-title" className={ui.cardTitle}>Team-Zugänge</h2>
            <SettingsList rows={[
              { title: user?.email ?? 'Dein Konto', detail: 'Inhaber · Admin', badge: 'active' },
            ]} />
            <button className={`${ui.secondaryButton} ${ui.small} ${styles.action}`} type="button" disabled title="Folgt bald">
              Person einladen
            </button>
          </section>
        </div>

        <div className={styles.column}>
          <section className={`${ui.card} ${ui.cardBordered}`} aria-labelledby="integrations-title">
            <h2 id="integrations-title" className={ui.cardTitle}>System-Schnittstellen</h2>
            <p className={ui.cardText}>Verknüpfungen liefern die Grundlage – veröffentlicht wird erst nach deiner Prüfung.</p>
            <SettingsList rows={[
              importedCount > 0
                ? { title: 'Kassensystem (POS)', detail: `Lightspeed · ${importedCount} Artikel importiert`, badge: 'connected' }
                : { title: 'Kassensystem (POS)', detail: 'Noch nicht verbunden' },
              { title: 'Lebensmittel-Datenbanken', detail: `BLS und Open Food Facts · ${foods.length} Lebensmittel hinterlegt`, badge: 'connected' },
              { title: 'Großhandel', detail: 'z. B. METRO', badge: 'soon' },
              { title: 'Smarte Küchenwaage', detail: 'Bluetooth', badge: 'soon' },
            ]} />
            <button className={`${ui.secondaryButton} ${ui.small} ${styles.action}`} type="button" disabled title="Folgt bald">
              Schnittstelle hinzufügen
            </button>
          </section>

          <section className={`${ui.card} ${ui.cardBordered}`} aria-labelledby="notifications-title">
            <h2 id="notifications-title" className={ui.cardTitle}>Benachrichtigungen</h2>
            <SettingsList rows={[
              { title: 'Prüfhinweise', detail: 'Wenn neue oder unsichere Angaben vorliegen', badge: 'soon' },
              { title: 'QR-Code-Scans', detail: 'Wöchentliche Zusammenfassung', badge: 'soon' },
              { title: 'Systemstatus', detail: 'Nur bei unterbrochenen Verbindungen', badge: 'soon' },
            ]} />
          </section>
        </div>
      </div>
    </div>
  );
}
