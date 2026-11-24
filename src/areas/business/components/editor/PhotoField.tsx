'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Camera, ImagePlus, SquarePen, Trash2 } from 'lucide-react';
import { PhotoCropDialog, type CropState, type Stroke } from './PhotoCropDialog';
import { canRemoveBackground, removeBackground, type RemovalStatus } from './removeBackground';
import ui from '../dashboard/Dashboard.module.css';
import styles from './Editor.module.css';

interface Photo {
  /** Original-Datei, aus der immer neu zugeschnitten wird */
  source: string;
  file: File;
  /** Freigestellte Fassung (PNG), einmal berechnet und dann wiederverwendet */
  cutout: string | null;
  useCutout: boolean;
  /** Radierer- und Pinselstriche, bleiben beim erneuten Bearbeiten erhalten */
  strokes: Stroke[];
  /** Angezeigtes Bild: zugeschnitten oder (noch) das Original */
  preview: string;
  crop: CropState | null;
  /** PNG, WebP, GIF und SVG können transparent sein – Transparenz beim Zuschneiden erhalten */
  transparent: boolean;
}

const NO_STROKES: Stroke[] = [];
const TRANSPARENT_TYPES = ['image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif'];

// Foto-Auswahl mit Zuschneiden und Löschen. Das Bild bleibt im Browser und wird noch nicht hochgeladen.
export function PhotoField({ caption }: { caption: string }) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [cropping, setCropping] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [removal, setRemoval] = useState<RemovalStatus | null>(null);
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [removalAvailable, setRemovalAvailable] = useState(false);
  useEffect(() => { canRemoveBackground().then(setRemovalAvailable); }, []);

  // Beim Verlassen der Seite die blob:-Adressen freigeben
  const latest = useRef(photo);
  useEffect(() => { latest.current = photo; }, [photo]);
  useEffect(() => () => release(latest.current), []);

  function release(entry: Photo | null) {
    if (!entry) return;
    URL.revokeObjectURL(entry.source);
    if (entry.cutout) URL.revokeObjectURL(entry.cutout);
    if (entry.preview !== entry.source) URL.revokeObjectURL(entry.preview);
  }

  function choose(file: File) {
    if (!file.type.startsWith('image/')) {
      setDropError('Bitte eine Bilddatei verwenden, z. B. JPG oder PNG.');
      return;
    }
    setDropError(null);
    setRemovalError(null);
    release(photo);
    const url = URL.createObjectURL(file);
    setPhoto({
      source: url, file, cutout: null, useCutout: false, strokes: NO_STROKES, preview: url, crop: null,
      transparent: TRANSPARENT_TYPES.includes(file.type),
    });
    setCropping(true);
  }

  // Läuft im Web Worker; das Ergebnis gehört nur zum Foto, für das es gestartet wurde
  async function createCutout() {
    if (!photo || photo.cutout || removal) return;
    const { file } = photo;
    setRemovalError(null);
    setRemoval({ phase: 'loading', progress: null });
    try {
      const url = URL.createObjectURL(await removeBackground(file, setRemoval));
      setPhoto(current => {
        if (current?.file !== file) { URL.revokeObjectURL(url); return current; }
        return { ...current, cutout: url };
      });
    } catch (error) {
      console.error(error);
      setRemovalError('Der Hintergrund konnte nicht entfernt werden. Bitte später erneut versuchen.');
    } finally {
      setRemoval(null);
    }
  }

  // Drag-and-drop auf das ganze Fenster: Zähler, weil dragenter/dragleave für jedes Kind-Element feuern
  const chooseRef = useRef(choose);
  const croppingRef = useRef(cropping);
  const hasPhotoRef = useRef(photo !== null);
  useEffect(() => { chooseRef.current = choose; croppingRef.current = cropping; hasPhotoRef.current = photo !== null; });

  // Strg+V / ⌘V fügt ein Bild aus der Zwischenablage ein, aber nur solange noch keins da ist:
  // ein vorhandenes Foto soll nicht versehentlich überschrieben werden
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (hasPhotoRef.current || croppingRef.current) return;
      // In Textfeldern bleibt Einfügen normales Texteinfügen
      const target = event.target as HTMLElement | null;
      if (target?.closest('input:not([type=file]), textarea, select, [contenteditable]:not([contenteditable=false])')) return;
      const file = [...(event.clipboardData?.files ?? [])].find(entry => entry.type.startsWith('image/'));
      if (!file) return;
      event.preventDefault();
      chooseRef.current(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;
    const reset = () => { depth = 0; setDragging(false); };
    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event) || croppingRef.current) return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const onOver = (event: DragEvent) => {
      if (!hasFiles(event) || croppingRef.current) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const onLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event) || croppingRef.current) return;
      event.preventDefault();
      reset();
      const file = event.dataTransfer?.files[0];
      if (file) chooseRef.current(file);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragend', reset);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragend', reset);
    };
  }, []);

  function remove() {
    release(photo);
    setPhoto(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className={styles.photoWrap}>
      {dragging && (
        <div className={styles.dropOverlay} aria-hidden="true">
          <div className={styles.dropCard}>
            <ImagePlus size={36} strokeWidth={1.75} />
            <strong>Foto hier ablegen</strong>
            <span>{photo ? 'Ersetzt das aktuelle Foto' : 'Irgendwo im Fenster loslassen'}</span>
          </div>
        </div>
      )}
      <div className={styles.photoFrame} data-dragging={dragging}>
        {photo ? (
          // Klick aufs Foto öffnet die Bearbeitung, nicht nur der kleine Stift-Knopf
          <button className={styles.photo} type="button" data-filled="true" onClick={() => setCropping(true)}>
            {/* Bewusst <img>: lokale blob:-Vorschau, dafür passt next/image nicht */}
            <img src={photo.preview} alt="" />
            <span className={ui.visuallyHidden}>Foto bearbeiten</span>
          </button>
        ) : (
          <label className={styles.photo} htmlFor={id} data-filled="false">
            <Camera aria-hidden="true" size={28} strokeWidth={1.75} />
            <span>{dragging ? 'Hier ablegen' : 'Foto hinzufügen'}</span>
            {!dragging && <span className={styles.photoHint}>oder ins Fenster ziehen</span>}
          </label>
        )}
        {photo && (
          <div className={styles.photoActions}>
            <button className={`${ui.iconButton} ${ui.iconButtonSmall}`} type="button" aria-label="Foto bearbeiten" title="Bearbeiten" onClick={() => setCropping(true)}>
              <SquarePen aria-hidden="true" size={16} />
            </button>
            <button className={`${ui.iconButton} ${ui.iconButtonSmall}`} type="button" aria-label="Foto löschen" title="Löschen" onClick={remove}>
              <Trash2 aria-hidden="true" size={16} />
            </button>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        id={id}
        className={styles.fileInput}
        type="file"
        accept="image/*"
        onChange={event => {
          const file = event.target.files?.[0];
          if (file) choose(file);
        }}
      />
      <p className={styles.photoCaption}>{caption}</p>
      {dropError && <p className={styles.photoError} role="alert">{dropError}</p>}

      <PhotoCropDialog
        open={cropping && photo !== null}
        src={photo?.source ?? null}
        initial={photo?.crop ?? null}
        transparent={photo?.transparent ?? false}
        cutout={photo?.cutout ?? null}
        initialUseCutout={photo?.useCutout ?? false}
        initialStrokes={photo?.strokes ?? NO_STROKES}
        canRemoveBackground={removalAvailable || photo?.cutout != null}
        removal={removal}
        removalError={removalError}
        onRemoveBackground={createCutout}
        onApply={({ url, crop, useCutout, strokes }) => {
          setPhoto(current => {
            if (!current) { URL.revokeObjectURL(url); return current; }
            if (current.preview !== current.source) URL.revokeObjectURL(current.preview);
            return { ...current, preview: url, crop, useCutout, strokes };
          });
          setCropping(false);
        }}
        onClose={() => setCropping(false)}
      />
    </div>
  );
}
