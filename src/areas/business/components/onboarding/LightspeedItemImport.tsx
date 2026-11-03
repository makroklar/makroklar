'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getItems } from '../../data/lightspeedItems';
import type { ImportedMenuItem } from '../../types/importedMenuItem';
import { useBusinessDraft } from '../../state/BusinessDraftContext';
import { getImportedItemKey, mergeImportedItems } from '../../state/businessDraft';
import styles from './LightspeedItemImport.module.css';

interface ItemDraft extends ImportedMenuItem {
  selected: boolean;
  nameInput: string;
  amountInput: string;
}

type DraftChanges = Partial<
  Pick<ItemDraft, 'selected' | 'nameInput' | 'amountInput' | 'selectedPriceIndex'>
>;

const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

function validAmount(value: string): number | null {
  if (value.trim() === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) &&
    amount >= 0 &&
    Number.isSafeInteger(Math.round(amount * 100)) &&
    Number(amount.toFixed(2)) === amount
    ? amount
    : null;
}

function validDraft(item: ItemDraft): boolean {
  return (
    item.nameInput.trim() !== '' &&
    item.selectedPriceIndex !== null &&
    item.prices[item.selectedPriceIndex] !== undefined &&
    validAmount(item.amountInput) !== null
  );
}

function createItemDraft(item: ImportedMenuItem, selected = false): ItemDraft {
  return {
    ...item,
    accountingGroup: item.accountingGroup ? { ...item.accountingGroup } : null,
    prices: item.prices.map((price) => ({ ...price })),
    selected,
    nameInput: item.name,
    amountInput:
      item.selectedPriceIndex === null
        ? ''
        : String(item.prices[item.selectedPriceIndex].amount),
  };
}

export function LightspeedItemImport() {
  const router = useRouter();
  const { importedItems, acceptItems } = useBusinessDraft();
  const [items, setItems] = useState<ItemDraft[]>(() =>
    importedItems.map((item) => createItemDraft(item, true)),
  );
  const [sourceLoaded, setSourceLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedItems = items.filter((item) => item.selected);
  const invalidSelection = selectedItems.some((item) => !validDraft(item));

  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const loaded = await getItems();
      const acceptedKeys = new Set(importedItems.map(getImportedItemKey));
      setItems((current) => {
        const currentById = new Map(
          current.map((item) => [getImportedItemKey(item), item]),
        );
        return mergeImportedItems(loaded, importedItems).map(
          (item) =>
            currentById.get(getImportedItemKey(item)) ??
            createItemDraft(item, acceptedKeys.has(getImportedItemKey(item))),
        );
      });
      setSourceLoaded(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Die lokalen Beispieldaten konnten nicht geladen werden.',
      );
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(sourceId: number, changes: DraftChanges) {
    setItems((current) =>
      current.map((item) =>
        item.sourceId === sourceId ? { ...item, ...changes } : item,
      ),
    );
  }

  function selectAll(selected: boolean) {
    setItems((current) => current.map((item) => ({ ...item, selected })));
  }

  function acceptSelection() {
    if (selectedItems.length === 0 || invalidSelection) return;
    const selected: ImportedMenuItem[] = selectedItems.map((item) => ({
      source: item.source,
      sourceId: item.sourceId,
      sku: item.sku,
      name: item.nameInput.trim(),
      accountingGroup: item.accountingGroup,
      prices: item.prices.map((price, index) => ({
        ...price,
        amount:
          index === item.selectedPriceIndex ? Number(item.amountInput) : price.amount,
      })),
      selectedPriceIndex: item.selectedPriceIndex,
    }));

    acceptItems(selected);
    router.push('/business/onboarding/menu/pos/complete');
  }

  return (
    <section className={styles.preview} aria-labelledby="lightspeed-import-title">
      <h2 className={styles.title} id="lightspeed-import-title">
        Lightspeed – lokale Beispielartikel
      </h2>
      <p className={styles.notice}>
        Demo mit lokalen Daten, ohne Verbindung zu Lightspeed. Übernommene Artikel
        bleiben beim Seitenwechsel im Business-Bereich verfügbar. Nur übernommene
        Änderungen stehen den nächsten Schritten zur Verfügung. Ein Neuladen
        löscht den Entwurf. Preise werden für diese Demo in EUR angezeigt.
      </p>

      {!sourceLoaded && (
        <button
          className={styles.primaryButton}
          type="button"
          onClick={loadItems}
          disabled={loading}
        >
          {loading ? 'Beispieldaten werden geladen…' : 'Beispielartikel laden'}
        </button>
      )}
      {items.length > 0 && (
        <>
          <p className={styles.summary} role="status">
            {items.length} Artikel in der Vorschau, {selectedItems.length} ausgewählt.
          </p>
          <div className={styles.toolbar}>
            <button className={styles.secondaryButton} type="button" onClick={() => selectAll(true)}>
              Alle auswählen
            </button>
            <button className={styles.secondaryButton} type="button" onClick={() => selectAll(false)}>
              Auswahl aufheben
            </button>
          </div>

          <div
            className={styles.tableWrapper}
            role="region"
            aria-label="Beispielartikel bearbeiten"
            tabIndex={0}
          >
            <table className={styles.table}>
              <caption className={styles.visuallyHidden}>
                Lokale Lightspeed-Beispielartikel: Auswahl, Name und Preis bearbeiten
              </caption>
              <thead>
                <tr>
                  <th scope="col"><span className={styles.visuallyHidden}>Auswahl</span></th>
                  <th scope="col">Artikel</th>
                  <th scope="col">Warengruppe</th>
                  <th scope="col">Preis (EUR)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.source}:${item.sourceId}`}>
                    <td>
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        checked={item.selected}
                        aria-label={`${item.nameInput || item.sku} auswählen`}
                        onChange={(event) => updateDraft(item.sourceId, { selected: event.target.checked })}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.input}
                        type="text"
                        value={item.nameInput}
                        aria-label={`Artikelname für ${item.sku}`}
                        aria-invalid={item.nameInput.trim() === ''}
                        onChange={(event) => updateDraft(item.sourceId, { nameInput: event.target.value })}
                      />
                      <small className={styles.metadata}>
                        SKU: {item.sku} · Lightspeed-ID: {item.sourceId}
                      </small>
                    </td>
                    <td>{item.accountingGroup?.name ?? 'Ohne Warengruppe'}</td>
                    <td>
                      {item.prices.length > 1 ? (
                        <select
                          className={styles.input}
                          aria-label={`Preis auswählen für ${item.sku}`}
                          value={item.selectedPriceIndex ?? ''}
                          onChange={(event) => {
                            const index = event.target.value === '' ? null : Number(event.target.value);
                            updateDraft(item.sourceId, {
                              selectedPriceIndex: index,
                              amountInput: index === null ? '' : String(item.prices[index].amount),
                            });
                          }}
                        >
                          <option value="">Preis wählen</option>
                          {item.prices.map((price, index) => (
                            <option key={index} value={index}>
                              {price.name}: {euro.format(price.amount)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <small className={styles.metadata}>
                          {item.prices[0]?.name ?? 'Kein Festpreis verfügbar'}
                        </small>
                      )}
                      <input
                        className={styles.input}
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={item.amountInput}
                        disabled={item.selectedPriceIndex === null}
                        aria-label={`Preis in Euro für ${item.sku}`}
                        aria-invalid={validAmount(item.amountInput) === null}
                        onChange={(event) => updateDraft(item.sourceId, { amountInput: event.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {invalidSelection && (
            <p className={styles.error} role="alert">
              Bitte für die ausgewählten Artikel einen Namen und einen gültigen
              Festpreis mit höchstens zwei Nachkommastellen angeben.
            </p>
          )}
          <button
            className={styles.primaryButton}
            type="button"
            disabled={selectedItems.length === 0 || invalidSelection}
            onClick={acceptSelection}
          >
            Auswahl temporär übernehmen
          </button>
        </>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}
      <div role="status" className={styles.accepted}>
        {importedItems.length > 0 && (
          <p>
            {importedItems.length} Demo-Artikel im gemeinsamen Business-Entwurf.
            Es wurden keine Daten dauerhaft gespeichert.
          </p>
        )}
      </div>
    </section>
  );
}
