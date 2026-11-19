import Link from 'next/link';
import { ArrowRight, Bell, Plus, ScanLine } from 'lucide-react';
import { PageHeader } from './components/dashboard/PageHeader';
import { TaskIcon } from './components/dashboard/TaskIcon';
import { OccupancyCard } from './components/dashboard/OccupancyCard';
import { getProgress, getRestaurantData, getTasks } from './data/restaurantData';
import ui from './components/dashboard/Dashboard.module.css';
import styles from './DashboardPage.module.css';

export async function DashboardPage() {
  const [{ restaurantName, importedCount, error }, tasks, progress] = await Promise.all([
    getRestaurantData(), getTasks(), getProgress(),
  ]);
  const progressPercent = progress.percent;
  const progressText = progress.text;

  return (
    <div className={ui.page}>
      <PageHeader
        title={`Hallo, ${restaurantName}!`}
        subtitle={importedCount > 0
          ? 'Dein Import war erfolgreich! Schau dir als nächstes deine To-do-Liste an.'
          : 'Schau dir als nächstes deine To-do-Liste an.'}
        actions={(
          <>
            {/* Benachrichtigungen und Scan haben in Figma noch kein Ziel */}
            <button className={ui.iconButton} type="button" disabled title="Folgt bald" aria-label="Benachrichtigungen (folgt bald)">
              <Bell aria-hidden="true" size={20} strokeWidth={1.75} />
            </button>
            <button className={ui.iconButton} type="button" disabled title="Folgt bald" aria-label="Scannen (folgt bald)">
              <ScanLine aria-hidden="true" size={20} strokeWidth={1.75} />
            </button>
            <Link className={ui.primaryButton} href="/business/neu/gericht">
              Neues Gericht <Plus aria-hidden="true" size={20} />
            </Link>
          </>
        )}
      />

      {error && <p className={styles.error} role="status">{error}</p>}

      <div className={styles.stats}>
        <section className={`${ui.card} ${styles.progressCard}`} aria-labelledby="progress-title">
          <h2 id="progress-title" className={ui.eyebrow}>Dein Fortschritt</h2>
          <p className={styles.progressValue}>{progressPercent} % bereit</p>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Fortschritt der Einrichtung"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <p className={styles.cardCopy}>{progressText}</p>
        </section>

        <section className={ui.card} aria-labelledby="scans-title">
          <h2 id="scans-title" className={styles.cardHeading}>QR-Code Scans</h2>
          <p className={styles.scanValue}>
            <span>0</span>
            <small>Zählung folgt bald</small>
          </p>
          <p className={styles.cardCopy}>
            Noch keine Scans. Stelle jetzt deine neuen Aufsteller auf die Tische und verfolge hier, wie oft
            Gäste deine Karte aufrufen!
          </p>
          <span className={styles.mutedLink} title="Folgt bald">Scan-Statistik ansehen →</span>
        </section>

        <OccupancyCard />
      </div>

      <section className={ui.card} aria-labelledby="todo-title">
        <h2 id="todo-title" className={styles.todoTitle}>To-do-Liste</h2>
        <ul className={ui.list}>
          {tasks.map(task => (
            <li key={task.id}>
              <Link className={`${ui.row} ${styles.todoRow}`} href={`/business/aufgaben/${task.id}`}>
                <span className={ui.rowIcon}><TaskIcon task={task.id} /></span>
                <span className={ui.rowText}>
                  <span className={ui.rowTitle}>
                    {task.title}
                  </span>
                  <span className={styles.todoMeta}>{task.total === 0 ? task.emptyText : task.summary(task.open)}</span>
                </span>
                <span className={ui.countButton}>
                  {task.open} offen <ArrowRight aria-hidden="true" size={16} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
