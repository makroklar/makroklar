import styles from './LastUpdated.module.css';

const dateFormat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Berlin',
});
const timeFormat = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Berlin',
});

// „zuletzt geändert am …“ unten rechts auf jedem Screen (Figma „Gastansicht“, Text 21:263)
export function LastUpdated({ date }: { date: Date }) {
  return (
    <footer className={styles.footer}>
      <time dateTime={date.toISOString()}>
        zuletzt geändert am {dateFormat.format(date)} - {timeFormat.format(date)} Uhr
      </time>
    </footer>
  );
}
