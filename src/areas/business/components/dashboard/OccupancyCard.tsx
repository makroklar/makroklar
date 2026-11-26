'use client';

import { useState } from 'react';
import ui from './Dashboard.module.css';
import styles from './OccupancyCard.module.css';

const levels = [
  { id: 'normal', label: 'Normal', state: 'Normaler Betrieb · Standardzeiten', note: 'Gäste sehen aktuell keine verlängerte Wartezeit.' },
  { id: 'hoch', label: 'Hoch', state: 'Hohe Auslastung · etwas länger', note: 'Gäste sehen einen Hinweis auf längere Wartezeiten.' },
  { id: 'voll', label: 'Voll', state: 'Volle Auslastung · deutlich länger', note: 'Gäste sehen einen Hinweis auf deutlich längere Wartezeiten.' },
] as const;

// Nur lokal: Die Auslastung wird noch nirgends gespeichert oder den Gästen angezeigt.
export function OccupancyCard() {
  const [level, setLevel] = useState<(typeof levels)[number]['id']>('normal');
  const [customOpen, setCustomOpen] = useState(false);
  const [minutes, setMinutes] = useState('');
  const current = levels.find(entry => entry.id === level)!;
  const hasMinutes = minutes.trim() !== '';

  return (
    <section className={ui.card} aria-labelledby="occupancy-title">
      <h2 id="occupancy-title" className={styles.heading}>Aktuelle Auslastung</h2>
      <p className={styles.state}>
        <span className={styles.dot} aria-hidden="true" />
        {hasMinutes ? `Eigene Wartezeit · ca. ${minutes} Min.` : current.state}
      </p>
      <p className={styles.note}>{hasMinutes ? 'Gäste sehen deine eingetragene Wartezeit.' : current.note}</p>
      <div className={styles.options} role="group" aria-label="Auslastung wählen">
        {levels.map(entry => (
          <button
            key={entry.id}
            className={styles.option}
            type="button"
            aria-pressed={!hasMinutes && level === entry.id}
            onClick={() => { setLevel(entry.id); setMinutes(''); }}
          >
            {entry.label}
          </button>
        ))}
      </div>
      {customOpen ? (
        <label className={`${ui.field} ${styles.minutes}`}>
          <span className={ui.visuallyHidden}>Wartezeit in Minuten</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={240}
            placeholder="z. B. 30"
            value={minutes}
            onChange={event => setMinutes(event.target.value)}
          />
          <span className={ui.fieldUnit}>Min.</span>
        </label>
      ) : (
        <button className={`${ui.textLink} ${styles.custom}`} type="button" onClick={() => setCustomOpen(true)}>
          Zeit eingeben
        </button>
      )}
    </section>
  );
}
