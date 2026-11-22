'use client';

import Image from 'next/image';
import { useState } from 'react';
import searchIcon from './assets/search.svg';
import { LightspeedItemImport } from './components/onboarding/LightspeedItemImport';
import {
  posProviders,
  type PosProvider,
  type PosProviderId,
} from './data/posProviders';
import styles from './PosImportPage.module.css';

interface ProviderCardProps {
  provider: PosProvider;
  selected: boolean;
  onSelect: (providerId: PosProviderId) => void;
}

function ProviderCard({ provider, selected, onSelect }: ProviderCardProps) {
  return (
    <button
      className={styles.provider}
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(provider.id)}
    >
      <span className={styles.logo}>
        <Image
          className={styles.logoImage}
          src={provider.logo}
          alt={provider.name}
        />
      </span>
    </button>
  );
}

export function PosImportPage() {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<PosProviderId | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const featuredProviders = posProviders.filter((provider) => provider.featured);
  const matchingProviders = normalizedQuery
    ? posProviders.filter((provider) =>
        provider.name.toLowerCase().includes(normalizedQuery),
      )
    : [];
  const selectedProvider = posProviders.find(
    (provider) => provider.id === selectedId,
  );

  function selectProvider(providerId: PosProviderId) {
    setSelectedId((current) => (current === providerId ? null : providerId));
  }

  return (
    <section
      className={styles.step}
      data-onboarding-card="compact"
      aria-labelledby="pos-import-title"
    >
      <header className={styles.intro}>
        <h1 className={styles.title} id="pos-import-title">
          Verknüpfe dein Kassensystem.
        </h1>
        <p className={styles.description}>
          Wähle deinen Anbieter aus, um deine Speisekarte und Preise sicher und
          automatisch zu importieren.
        </p>
      </header>

      <ul className={styles.providers} aria-label="Häufige Kassensysteme">
        {featuredProviders.map((provider) => (
          <li key={provider.id}>
            <ProviderCard
              provider={provider}
              selected={selectedId === provider.id}
              onSelect={selectProvider}
            />
          </li>
        ))}
      </ul>

      <p className={styles.separator}>Oder</p>

      <div role="search" aria-label="Kassensysteme durchsuchen">
        <label className={styles.visuallyHidden} htmlFor="pos-provider-search">
          Anderes Kassensystem suchen
        </label>
        <div className={styles.searchField}>
          <span className={styles.searchIcon}>
            <Image src={searchIcon} alt="" />
          </span>
          <input
            className={styles.searchInput}
            id="pos-provider-search"
            type="search"
            autoComplete="off"
            placeholder="Anderes Kassensystem suchen..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-controls="pos-search-results"
          />
        </div>
      </div>

      <div id="pos-search-results">
        {normalizedQuery &&
          (matchingProviders.length > 0 ? (
            <ul className={styles.providers} aria-label="Suchergebnisse">
              {matchingProviders.map((provider) => (
                <li key={provider.id}>
                  <ProviderCard
                    provider={provider}
                    selected={selectedId === provider.id}
                    onSelect={selectProvider}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.noResults}>
              Kein passendes Kassensystem gefunden.
            </p>
          ))}
      </div>

      <p className={styles.visuallyHidden} role="status">
        {normalizedQuery
          ? `${matchingProviders.length} Kassensysteme gefunden.`
          : ''}
      </p>

      <div className={styles.selectionNotice} role="status">
        {selectedProvider && (
          <p>
            {selectedProvider.name} ausgewählt. Es wurde noch keine Verbindung
            hergestellt.
          </p>
        )}
      </div>
      {selectedId === 'lightspeed' && <LightspeedItemImport />}
    </section>
  );
}
