import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { PageHeader } from './components/dashboard/PageHeader';
import { TaskIcon } from './components/dashboard/TaskIcon';
import { getRecipe, getTask } from './data/restaurantData';
import ui from './components/dashboard/Dashboard.module.css';
import styles from './TaskOverviewPage.module.css';

// Aufgabenübersicht (Figma „App / Aufgabe / …“): offene Einträge, Fortschritt, nächster Schritt
export async function TaskOverviewPage({ taskId }: { taskId: string }) {
  const task = await getTask(taskId);
  if (!task) notFound();

  const entries = (await Promise.all(task.items.map(slug => getRecipe(slug))))
    .flatMap(recipe => recipe ? [recipe] : []);
  const done = task.total - task.open;
  const next = entries[0];

  return (
    <div className={ui.page}>
      <PageHeader
        back={{ href: '/business', label: 'Zurück zur Aufgabenübersicht' }}
        icon={<TaskIcon task={task.id} size={24} />}
        title={task.title}
        subtitle={task.subtitle}
      />

      <div className={styles.layout}>
        <section className={ui.card} aria-labelledby="open-title">
          <h2 id="open-title" className={ui.cardTitle}>
            {task.id === 'lmiv-freigabe' ? 'Offene Einträge' : 'Offene Aufgaben'}
          </h2>
          {entries.length === 0 ? (
            <p className={ui.cardText}>{task.total === 0 ? task.emptyText : 'Alles erledigt – hier gibt es gerade nichts zu tun.'}</p>
          ) : (
            <ul className={ui.list}>
              {entries.map(recipe => (
                <li key={recipe.slug}>
                  <Link className={`${ui.row} ${styles.entry}`} href={`/business/aufgaben/${task.id}/${recipe.slug}`}>
                    <span className={ui.rowIcon}><TaskIcon task={task.id} /></span>
                    <span className={ui.rowText}>
                      <span className={ui.rowTitle}>{recipe.name}</span>
                      <span className={ui.rowMeta}>{task.itemHint}</span>
                    </span>
                    <span className={`${ui.iconButton} ${ui.iconButtonSmall}`} aria-hidden="true">
                      <ArrowRight size={16} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className={`${ui.card} ${styles.aside}`} aria-label="Fortschritt">
          <h2 className={ui.eyebrow}>Fortschritt</h2>
          <div
            className={styles.track}
            role="progressbar"
            aria-label={`${task.title}: erledigte Einträge`}
            aria-valuemin={0}
            aria-valuemax={task.total}
            aria-valuenow={done}
          >
            <span style={{ width: `${task.total === 0 ? 100 : (done / task.total) * 100}%` }} />
          </div>
          <p className={styles.count}>{done} von {task.total}</p>

          <div className={styles.info}>
            <h3>{task.infoTitle}</h3>
            <p>{task.infoText}</p>
          </div>

          {next && (
            <Link className={styles.next} href={`/business/aufgaben/${task.id}/${next.slug}`}>
              <span className={styles.nextEyebrow}>Nächster Schritt</span>
              <span className={styles.nextTitle}>{task.nextAction(next.name)}</span>
              <span className={styles.nextLink}>Jetzt öffnen →</span>
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
