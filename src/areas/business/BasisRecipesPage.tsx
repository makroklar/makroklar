'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { ArrowIcon } from './components/ui/ArrowIcon';
import { BasisRecipeEditor } from './components/onboarding/BasisRecipeEditor';
import { useBusinessDraft } from './state/BusinessDraftContext';
import styles from './BasisRecipesPage.module.css';

export function BasisRecipesPage() {
  const { basisRecipes, upsertBasisRecipe, basisError, clearBasisError, basisPersistenceReady } = useBusinessDraft();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setNameError(true);
      nameInput.current?.focus();
      return;
    }
    const id = crypto.randomUUID();
    upsertBasisRecipe({ id, name: name.trim(), outputQuantity: null, outputUnit: 'g', ingredients: [] });
    setSelectedId(id);
    setName('');
    setNameError(false);
  }

  return (
    <section className={styles.page} aria-labelledby="basis-recipes-title">
      <header className={styles.intro}>
        <h1 id="basis-recipes-title">Erstelle deine Basisrezepte.</h1>
        <p>Bereite wiederverwendbare Rezepte wie Pizzateig, Tomatensauce oder Dressing vor.
          Dieser Schritt ist optional.</p>
      </header>
      <p className={styles.notice}>{basisPersistenceReady
        ? 'Neue Änderungen bleiben bis „Einrichtung abschließen“ vorläufig. Gespeicherte Basisrezepte werden beim nächsten Besuch wieder geladen.'
        : 'Zum Ausprobieren: Neue Änderungen an Basisrezepten bleiben aktuell nur in dieser Sitzung erhalten. Beim Neuladen gehen sie verloren. Die erweiterte Rezept-Speicherung ist noch nicht verfügbar.'}</p>

      <form className={styles.addForm} onSubmit={add} noValidate>
        <label className={styles.field} htmlFor="new-basis-name">Name des neuen Basisrezepts
          <input ref={nameInput} id="new-basis-name" value={name} maxLength={500} required
            placeholder="z. B. Tomatensauce" aria-invalid={nameError}
            aria-describedby={nameError ? 'new-basis-error' : undefined}
            onChange={event => { setName(event.target.value); setNameError(false); }} />
        </label>
        <button type="submit" className={styles.secondaryButton}>Basisrezept hinzufügen</button>
        {nameError && <p id="new-basis-error" className={styles.error} role="alert">Bitte einen Namen eingeben.</p>}
      </form>

      {basisError && <div className={styles.error} role="alert">
        <p>{basisError}</p>
        <button className={styles.textButton} type="button" onClick={clearBasisError}>Hinweis schließen</button>
      </div>}

      <h2 className={styles.listTitle}>Deine Basisrezepte ({basisRecipes.length})</h2>
      {basisRecipes.length === 0 ? (
        <p className={styles.note}>Noch keine Basisrezepte angelegt. Du kannst auch direkt mit deinen Gerichten weitermachen.</p>
      ) : <ul className={styles.list}>
        {basisRecipes.map(recipe => {
          const selected = selectedId === recipe.id;
          return <li className={styles.recipe} key={recipe.id}>
            <button className={styles.recipeButton} type="button" id={`basis-button-${recipe.id}`}
              aria-expanded={selected} aria-controls={`basis-details-${recipe.id}`}
              onClick={() => setSelectedId(selected ? null : recipe.id)}>
              <span className={styles.summary}>
                <strong>{recipe.name.trim() || 'Basisrezept ohne Namen'}</strong>
                <span>{recipe.ingredients.length} Zutaten · {recipe.outputQuantity
                  ? `Nettomenge: ${recipe.outputQuantity} ${recipe.outputUnit}` : 'Nettomenge noch offen'}</span>
              </span>
              <span className={styles.selection}>{selected ? 'Schließen' : 'Bearbeiten'}<ArrowIcon tone="inherit" /></span>
            </button>
            <div id={`basis-details-${recipe.id}`} hidden={!selected}
              role="region" aria-labelledby={`basis-button-${recipe.id}`}>
              {selected && <BasisRecipeEditor recipe={recipe} onRemoved={() => {
                setSelectedId(null);
                nameInput.current?.focus();
              }} />}
            </div>
          </li>;
        })}
      </ul>}

      <p className={styles.note}>Änderungen an angelegten Basisrezepten werden beim Wechsel zwischen den Schritten mitgenommen.</p>
      <div className={styles.actions}>
        <Link className={styles.continueButton} href="/business/onboarding/dishes">
          <span>{basisRecipes.length ? 'Weiter' : 'Ohne Basisrezepte weiter'}</span><ArrowIcon tone="inherit" />
        </Link>
      </div>
    </section>
  );
}
