'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Camera, Crop, Trash2 } from 'lucide-react';
import { PhotoCropDialog, type CropState } from './PhotoCropDialog';
import ui from '../dashboard/Dashboard.module.css';
import styles from './Editor.module.css';

interface Photo {
  /** Original-Datei, aus der immer neu zugeschnitten wird */
  source: string;
  /** Angezeigtes Bild: zugeschnitten oder (noch) das Original */
  preview: string;
  crop: CropState | null;
}

// Foto-Auswahl mit Zuschneiden und Löschen. Das Bild bleibt im Browser und wird noch nicht hochgeladen.
export function PhotoField({ caption }: { caption: string }) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [cropping, setCropping] = useState(false);

  // Beim Verlassen der Seite die blob:-Adressen freigeben
  const latest = useRef(photo);
  useEffect(() => { latest.current = photo; }, [photo]);
  useEffect(() => () => release(latest.current), []);

  function release(entry: Photo | null) {
    if (!entry) return;
    URL.revokeObjectURL(entry.source);
    if (entry.preview !== entry.source) URL.revokeObjectURL(entry.preview);
  }

  function choose(file: File) {
    release(photo);
    const url = URL.createObjectURL(file);
    setPhoto({ source: url, preview: url, crop: null });
    setCropping(true);
  }

  function remove() {
    release(photo);
    setPhoto(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className={styles.photoWrap}>
      <div className={styles.photoFrame}>
        <label className={styles.photo} htmlFor={id} data-filled={photo !== null}>
          {photo ? (
            // Bewusst <img>: lokale blob:-Vorschau, dafür passt next/image nicht
            <img src={photo.preview} alt="Ausgewähltes Foto" />
          ) : (
            <>
              <Camera aria-hidden="true" size={28} strokeWidth={1.75} />
              <span>Foto hinzufügen</span>
            </>
          )}
          {photo && <span className={ui.visuallyHidden}>Anderes Foto wählen</span>}
        </label>
        {photo && (
          <div className={styles.photoActions}>
            <button className={`${ui.iconButton} ${ui.iconButtonSmall}`} type="button" aria-label="Foto zuschneiden" title="Zuschneiden" onClick={() => setCropping(true)}>
              <Crop aria-hidden="true" size={16} />
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

      <PhotoCropDialog
        open={cropping && photo !== null}
        src={photo?.source ?? null}
        initial={photo?.crop ?? null}
        onApply={({ url, crop }) => {
          setPhoto(current => {
            if (!current) { URL.revokeObjectURL(url); return current; }
            if (current.preview !== current.source) URL.revokeObjectURL(current.preview);
            return { ...current, preview: url, crop };
          });
          setCropping(false);
        }}
        onClose={() => setCropping(false)}
      />
    </div>
  );
}
