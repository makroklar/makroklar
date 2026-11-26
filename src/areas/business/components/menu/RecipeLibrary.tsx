'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { editHref, type Recipe } from '../../data/dashboardModel';
import ui from '../dashboard/Dashboard.module.css';
import styles from './RecipeLibrary.module.css';

type Filter = 'all' | 'menu' | 'dish' | 'basis' | 'incomplete';

const filters: { id: Filter; label: string; test: (recipe: Recipe) => boolean }[] = [
  { id: 'all', label: 'Alle', test: () => true },
  { id: 'menu', label: 'Auf der Karte', test: recipe => recipe.onMenu },
  { id: 'dish', label: 'Gerichte', test: recipe => recipe.kind === 'dish' },
  { id: 'basis', label: 'Basen', test: recipe => recipe.kind === 'basis' },
  { id: 'incomplete', label: 'Unvollständig', test: recipe => recipe.missing !== null },
];

function kindLabel(recipe: Recipe) {
  if (recipe.kind === 'basis') return `Basis · in ${recipe.usedInDishes ?? 0} Gerichten`;
  return `${recipe.category} · ${recipe.onMenu ? 'auf der Karte' : 'Entwurf'}`;
}

export function RecipeLibrary({ recipes }: { recipes: Recipe[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase('de-DE');
  const active = filters.find(entry => entry.id === filter)!;
  const visible = recipes.filter(recipe => active.test(recipe)
    && (needle === '' || recipe.name.toLocaleLowerCase('de-DE').includes(needle)));

  return (
    <>
      <label className={styles.search}>
        <Search aria-hidden="true" size={20} />
        <span className={ui.visuallyHidden}>Rezepte durchsuchen</span>
        <input type="search" placeholder="Gericht oder Basis suchen …" value={query} onChange={event => setQuery(event.target.value)} />
      </label>

      <div className={ui.chips} role="group" aria-label="Rezepte filtern">
        {filters.map(entry => (
          <button key={entry.id} className={ui.chip} type="button" aria-pressed={filter === entry.id} onClick={() => setFilter(entry.id)}>
            {entry.label} {recipes.filter(entry.test).length}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className={styles.none}>Keine Rezepte gefunden.</p>
      ) : (
        <ul className={styles.list}>
          {visible.map(recipe => (
            <li key={recipe.slug} className={styles.item}>
              <span className={styles.badge} aria-hidden="true">{recipe.name.slice(0, 2).toUpperCase()}</span>
              <div className={styles.name}>
                <strong>{recipe.name}</strong>
                <span>{kindLabel(recipe)}</span>
              </div>
              <dl className={styles.meta}>
                <div>
                  <dt>Datenstand</dt>
                  <dd className={recipe.missing ? styles.missing : undefined}>{recipe.missing ?? 'Vollständig'}</dd>
                </div>
                <div>
                  <dt>Quelle</dt>
                  <dd>{recipe.source}</dd>
                </div>
              </dl>
              <Link className={`${ui.secondaryButton} ${ui.small}`} href={editHref(recipe)} aria-label={`${recipe.name} bearbeiten`}>
                Bearbeiten
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
