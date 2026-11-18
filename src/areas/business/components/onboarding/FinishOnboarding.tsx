'use client';

import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBusinessDraft } from '../../state/BusinessDraftContext';
import { onboardingPayloadSchema, type CompletionSummary } from '../../data/onboardingModel';
import { finishOnboarding } from '../../data/finishOnboardingAction';
import processing from '../../assets/onboarding/processing.svg';
import arrowRight from '../../assets/onboarding/arrow-right.svg';
import arrowUpRight from '../../assets/onboarding/arrow-up-right.svg';
import styles from './FinishOnboarding.module.css';

export function FinishOnboarding() {
  const draft = useBusinessDraft();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<{ input: string; id: string } | null>(null);
  const busy = useRef(false);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'error' | 'complete'>('idle');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<CompletionSummary | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (phase !== 'idle' && !dialog.current?.open) dialog.current?.showModal();
    if (phase === 'idle') dialog.current?.close();
  }, [phase]);

  async function finish() {
    if (busy.current) return;
    const payload = onboardingPayloadSchema.safeParse({ importedIds: draft.importedItems.map(item => item.sourceId),
      customDishes: draft.customDishes, recipes: draft.recipes, catalogFoods: draft.catalogFoods, manualFoods: draft.manualFoods });
    if (!payload.success) { setError(payload.error.issues[0]?.message ?? 'Bitte prüfe deine Eingaben.'); setPhase('error'); return; }
    if (draft.storageError || draft.onboardingError) { setError(draft.storageError ?? draft.onboardingError ?? 'Bitte lade deine Daten erneut.'); setPhase('error'); return; }
    const input = JSON.stringify({ payload: payload.data, version: draft.onboardingVersion });
    if (request.current?.input !== input) request.current = { input, id: crypto.randomUUID() };
    busy.current = true; setError(''); setShowSummary(false); setPhase('saving');
    try {
      const result = await finishOnboarding({ payload: payload.data, version: draft.onboardingVersion, requestId: request.current.id });
      if (result.status === 'error') { setError(result.message); setPhase('error'); return; }
      draft.acceptInitialization(result.summary);
      setSummary(result.summary); setPhase('complete');
      router.refresh();
    } catch { setError('Das Speichern konnte nicht bestätigt werden. Bitte versuche es erneut.'); setPhase('error'); }
    finally { busy.current = false; }
  }

  return (
    <>
      <div className={styles.finishAction}>
        <p>Gerichte ohne vollständige Nährwerte werden als Entwürfe gespeichert. Du kannst sie später ergänzen.</p>
        {draft.onboardingError && <p role="status">{draft.onboardingError}</p>}
        <button className={styles.primaryButton} type="button" onClick={() => void finish()}>Einrichtung abschließen</button>
      </div>
      <dialog className={styles.dialog} ref={dialog} aria-labelledby="finish-title"
        onCancel={event => { event.preventDefault(); if (!busy.current) setPhase('idle'); }}>
        {showSummary && summary ? (
          <div className={styles.welcome}>
            <h2 id="finish-title">Willkommen,<br />{summary.restaurantName}.</h2>
            <p>Deine Einrichtung wurde gespeichert: {summary.dishCount} Gerichte und {summary.foodCount} Lebensmittel.
              {' '}{summary.completeCount} Gerichte sind vollständig berechnet; {summary.draftCount} bleiben Entwürfe.</p>
            <div className={styles.welcomeActions}>
              <button type="button" className={styles.primaryButton} onClick={() => setPhase('idle')}>Import jetzt prüfen <Image src={arrowRight} alt="" /></button>
              <Link className={styles.dashboardLink} href="/business">Zum Dashboard <Image src={arrowUpRight} alt="" /></Link>
            </div>
          </div>
        ) : phase === 'error' ? (
          <div className={styles.failure}>
            <h2 id="finish-title">Einrichtung noch nicht abgeschlossen</h2>
            <p role="alert">{error}</p>
            <p>Deine Eingaben bleiben in dieser Sitzung erhalten.</p>
            <div className={styles.welcomeActions}>
              {draft.storageError || draft.onboardingError
                ? <button className={styles.primaryButton} type="button" onClick={() => router.refresh()}>Gespeicherte Daten erneut laden</button>
                : <button className={styles.primaryButton} type="button" onClick={() => void finish()}>Erneut versuchen</button>}
              <button className={styles.textButton} type="button" onClick={() => setPhase('idle')}>Zurück zur Bearbeitung</button>
            </div>
          </div>
        ) : (
          <div className={styles.processing}>
            <header>
              <h2 id="finish-title">{phase === 'complete' ? 'Deine Daten wurden gespeichert.' : 'Deine Daten werden verarbeitet …'}</h2>
              <p>{phase === 'complete' ? 'Die Berechnung wurde geprüft. Unvollständige Gerichte bleiben Entwürfe.' : 'Bitte schließe dieses Fenster nicht. Wir bereiten deine digitale Speisekarte vor.'}</p>
            </header>
            <progress className={styles.progress} max={4} value={phase === 'complete' ? 4 : 1} aria-label="Einrichtung speichern" />
            <ul className={styles.stages} aria-live="polite">
              <li><CheckCircle size={20} aria-hidden="true" />Speisekarte geprüft</li>
              <li>{phase === 'complete' ? <CheckCircle size={20} aria-hidden="true" /> : <Image className={styles.spinner} src={processing} alt="" />}Lebensmittel und Rezepte {phase === 'complete' ? 'gespeichert' : 'werden gespeichert …'}</li>
              {phase === 'complete' && <>
                <li><CheckCircle size={20} aria-hidden="true" />Zutaten und Mengen abgeglichen</li>
                <li><CheckCircle size={20} aria-hidden="true" />Nährwerte geprüft und berechnet</li>
              </>}
            </ul>
            {phase === 'complete' && <button className={styles.primaryButton} type="button" onClick={() => setShowSummary(true)}>Ergebnis ansehen</button>}
          </div>
        )}
      </dialog>
    </>
  );
}
