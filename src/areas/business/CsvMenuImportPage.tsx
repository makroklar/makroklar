'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type ChangeEvent } from 'react';
import { ArrowIcon } from './components/ui/ArrowIcon';
import { useBusinessDraft } from './state/BusinessDraftContext';
import { acceptCsvPreview, createCsvPreview, csvRowErrors, duplicateCsvRowIds, suggestCsvMapping,
  CSV_TEMPLATE, MENU_MAX_CUSTOM_DISHES, type CsvMenuMapping, type CsvMenuRow, type CsvMenuTable } from './data/csvMenuModel';
import { parseCsvMenu, readCsvMenu, type CsvDelimiter } from './data/readCsvMenu';
import styles from './CsvMenuImportPage.module.css';

export function CsvMenuImportPage() {
  const { customDishes, importedItems, addCustomDishes, onboardingError, storageError } = useBusinessDraft();
  const [source, setSource] = useState<{ name: string; text: string } | null>(null);
  const [table, setTable] = useState<CsvMenuTable | null>(null);
  const [mapping, setMapping] = useState<CsvMenuMapping>({ nameColumn: null, priceColumn: null });
  const [delimiter, setDelimiter] = useState<CsvDelimiter>('');
  const [rows, setRows] = useState<CsvMenuRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(0);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const request = useRef(0);
  const submitted = useRef(false);
  const previewTitle = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  const readError = onboardingError || storageError;
  const existingNames = [...customDishes.map(dish => dish.name), ...importedItems.map(dish => dish.name)];
  const duplicates = duplicateCsvRowIds(rows, existingNames);
  const selected = rows.filter(row => row.selected);
  const invalid = selected.some(row => Object.keys(csvRowErrors(row)).length > 0);
  // The save allows at most 1000 dishes in total, POS dishes included.
  const existingCount = customDishes.length + importedItems.length;
  const overLimit = existingCount + selected.length > MENU_MAX_CUSTOM_DISHES;

  useEffect(() => () => { request.current++; }, []);

  function resetPreview() {
    setRows([]); setAccepted(0); setAllowDuplicates(false); submitted.current = false;
  }

  function parseSource(text: string, separator: CsvDelimiter) {
    setTable(null); resetPreview(); setError('');
    try {
      const next = parseCsvMenu(text, separator);
      setTable(next); setMapping(suggestCsvMapping(next.headers));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Die CSV konnte nicht gelesen werden.');
    }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // Selecting the same file again must trigger onChange.
    if (!file) return;
    const token = ++request.current;
    setLoading(true); setError(''); setSource(null); setTable(null); resetPreview(); setDelimiter('');
    try {
      const text = await readCsvMenu(file);
      if (token !== request.current) return;
      setSource({ name: file.name, text }); parseSource(text, '');
    } catch (cause) {
      if (token === request.current) setError(cause instanceof Error ? cause.message : 'Die Datei konnte nicht gelesen werden. Bitte erneut auswählen.');
    } finally {
      if (token === request.current) setLoading(false);
    }
  }

  function showPreview() {
    if (!table) return;
    try {
      const next = createCsvPreview(table, mapping, () => crypto.randomUUID());
      setRows(next); setError(''); setAllowDuplicates(false);
      requestAnimationFrame(() => previewTitle.current?.focus());
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Bitte die Spaltenzuordnung prüfen.'); }
  }

  function updateRow(id: string, changes: Partial<Pick<CsvMenuRow, 'name' | 'price' | 'selected'>>) {
    setRows(current => current.map(row => row.id === id ? { ...row, ...changes } : row));
    setAllowDuplicates(false); setError('');
  }

  function accept() {
    if (submitted.current || readError || loading) return;
    try {
      const dishes = acceptCsvPreview(rows, existingNames, existingCount, allowDuplicates);
      submitted.current = true;
      addCustomDishes(dishes); setAccepted(dishes.length); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Die Auswahl konnte nicht übernommen werden.'); }
  }

  return (
    <section className={styles.page} aria-labelledby="csv-menu-title">
      <header className={styles.intro}>
        <h1 id="csv-menu-title">Importiere deine Speisekarte.</h1>
        <p>Lies deine Gerichte aus einer CSV-Datei ein und prüfe Namen und Preise vor der Übernahme.</p>
      </header>
      <p className={styles.note}>CSV UTF-8, maximal 1 MB und 500 Gerichte. Die erste Zeile enthält Spaltennamen. Preise sind optional und in Euro, z. B. 9,50. PDF wird noch nicht unterstützt.</p>
      <a className={styles.textLink} download="makroklar-speisekarte-vorlage.csv"
        href={`data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`}>CSV-Vorlage herunterladen</a>
      <label className={styles.fileField} htmlFor="menu-csv-file">CSV-Datei auswählen
        <input id="menu-csv-file" type="file" accept=".csv,text/csv" onChange={chooseFile} aria-describedby="csv-local-note" />
      </label>
      <p className={styles.note} id="csv-local-note">Die Datei wird nur in deinem Browser gelesen und nicht hochgeladen. Eine neue Datei ersetzt die noch nicht übernommene Vorschau.</p>
      <p role="status" className={styles.status}>{loading ? 'Datei wird gelesen …' : source ? `Datei: ${source.name}` : ''}</p>

      {source && !loading && !accepted && rows.length === 0 && (
        <label className={styles.field}>Trennzeichen
          <select value={delimiter} onChange={event => {
            const next = event.target.value as CsvDelimiter;
            setDelimiter(next); parseSource(source.text, next);
          }}>
            <option value="">Automatisch erkennen</option><option value=";">Semikolon (;)</option><option value=",">Komma (,)</option>
          </select>
        </label>
      )}
      {table && rows.length === 0 && (
        <div className={styles.mapping}>
          <p>{table.records.length} Datensätze gefunden. Ordne die Spalten zu; alle anderen Spalten werden nicht importiert.</p>
          <div className={styles.fields}>
            <label className={styles.field}>Name des Gerichts
              <select value={mapping.nameColumn ?? ''} onChange={event => setMapping(current => ({ ...current, nameColumn: event.target.value === '' ? null : Number(event.target.value) }))}>
                <option value="">Spalte auswählen</option>
                {table.headers.map((header, index) => <option key={index} value={index}>{index + 1}: {header || '(ohne Titel)'}</option>)}
              </select>
            </label>
            <label className={styles.field}>Preis (optional)
              <select value={mapping.priceColumn ?? ''} onChange={event => setMapping(current => ({ ...current, priceColumn: event.target.value === '' ? null : Number(event.target.value) }))}>
                <option value="">Kein Preis</option>
                {table.headers.map((header, index) => <option key={index} value={index}>{index + 1}: {header || '(ohne Titel)'}</option>)}
              </select>
            </label>
          </div>
          <button type="button" className={styles.secondaryButton} onClick={showPreview}>Vorschau erstellen</button>
        </div>
      )}
      {readError && <div className={styles.message}>
        <p role="alert" className={styles.error}>{readError}</p>
        <button className={styles.textButton} type="button" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}>
          {refreshing ? 'Wird geladen …' : 'Erneut laden'}
        </button>
      </div>}
      {error && <p role="alert" className={styles.error}>{error}</p>}

      {rows.length > 0 && (
        <div className={styles.preview}>
          <h2 ref={previewTitle} tabIndex={-1}>Gerichte prüfen</h2>
          <p>Leerer Preis bedeutet „Preis offen“, nicht 0 €. Bitte fehlerhafte Datensätze korrigieren oder abwählen.</p>
          <fieldset className={styles.review} disabled={accepted > 0}>
            <legend className={styles.visuallyHidden}>Gerichte auswählen und bearbeiten</legend>
            <div className={styles.toolbar}>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={rows.every(row => row.selected)} onChange={event => {
                  const checked = event.target.checked;
                  setRows(current => current.map(row => ({ ...row, selected: checked }))); setAllowDuplicates(false);
                }} /> Alle auswählen
              </label>
              <button className={styles.textButton} type="button" onClick={() => { resetPreview(); setError(''); }}>Spalten neu zuordnen</button>
            </div>
            <div className={styles.tableRegion} role="region" aria-label="CSV-Vorschau" tabIndex={0}>
              <table className={styles.table}>
                <caption className={styles.visuallyHidden}>Auswahl, Name und Preis der CSV-Gerichte</caption>
                <thead><tr><th scope="col">Auswahl</th><th scope="col">Name</th><th scope="col">Preis (€)</th></tr></thead>
                <tbody>{rows.map(row => {
                  const errors = csvRowErrors(row);
                  return <tr key={row.id}>
                    <td><label className={styles.checkboxLabel}><input type="checkbox" checked={row.selected} onChange={event => updateRow(row.id, { selected: event.target.checked })} aria-label={`Datensatz ${row.recordNumber} übernehmen`} /><span>{row.recordNumber}</span></label></td>
                    <td><input value={row.name} onChange={event => updateRow(row.id, { name: event.target.value })} aria-label={`Name in Datensatz ${row.recordNumber}`} aria-invalid={row.selected && !!errors.name} aria-describedby={row.selected && errors.name ? `name-error-${row.id}` : undefined} />
                      {row.selected && errors.name && <small className={styles.error} id={`name-error-${row.id}`}>{errors.name}</small>}
                      {!accepted && duplicates.has(row.id) && <small className={styles.duplicate}>Gleichnamiges Gericht vorhanden oder mehrfach ausgewählt.</small>}
                    </td>
                    <td><input value={row.price} inputMode="decimal" placeholder="Preis offen" onChange={event => updateRow(row.id, { price: event.target.value })} aria-label={`Preis in Datensatz ${row.recordNumber}`} aria-invalid={row.selected && !!errors.price} aria-describedby={row.selected && errors.price ? `price-error-${row.id}` : undefined} />
                      {row.selected && errors.price && <small className={styles.error} id={`price-error-${row.id}`}>{errors.price}</small>}
                    </td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
            {!accepted && duplicates.size > 0 && <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={allowDuplicates} onChange={event => setAllowDuplicates(event.target.checked)} />
              Gleichnamige Gerichte geprüft: Ich möchte sie als zusätzliche Gerichte übernehmen. Bestehende Gerichte bleiben unverändert.
            </label>}
          </fieldset>
          {!accepted && <>
            <p role="status">{selected.length} von {rows.length} Gerichten ausgewählt.</p>
            {invalid && <p className={styles.error}>Bitte die markierten Felder korrigieren oder die betroffenen Datensätze abwählen.</p>}
            {overLimit && <p className={styles.error}>Insgesamt sind höchstens 1000 manuell erstellte/importierte Gerichte möglich. Bitte weniger auswählen.</p>}
            <button className={styles.primaryButton} type="button" onClick={accept}
              disabled={!!readError || loading || invalid || overLimit || selected.length === 0 || (duplicates.size > 0 && !allowDuplicates)}>
              Gerichte übernehmen
            </button>
          </>}
        </div>
      )}
      <p role="status" className={styles.status}>{accepted > 0 ? `${accepted} Gerichte übernommen. Du kannst mit den Lebensmitteln weitermachen.` : ''}</p>
      <p className={styles.note}>Erst „Gerichte übernehmen“ fügt die Auswahl deiner Speisekarte hinzu. Gespeichert wird am Ende bei „Einrichten abschließen“. Beim Neuladen gehen ungespeicherte Änderungen verloren.</p>
      <div className={styles.actions}><Link className={styles.primaryButton} href="/business/onboarding/purchases"><span>Weiter</span><ArrowIcon tone="inherit" /></Link></div>
    </section>
  );
}
