'use client';

import { useEffect, useId, useState } from 'react';
import { Camera } from 'lucide-react';
import styles from './Editor.module.css';

// Foto-Auswahl mit Vorschau. Das Bild bleibt im Browser und wird noch nicht hochgeladen.
export function PhotoField({ caption }: { caption: string }) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <div className={styles.photoWrap}>
      <label className={styles.photo} htmlFor={id} data-filled={preview !== null}>
        {preview ? (
          // Bewusst <img>: lokale blob:-Vorschau, dafür passt next/image nicht
          <img src={preview} alt="Ausgewähltes Foto" />
        ) : (
          <>
            <Camera aria-hidden="true" size={28} strokeWidth={1.75} />
            <span>Foto hinzufügen</span>
          </>
        )}
      </label>
      <input
        id={id}
        className={styles.fileInput}
        type="file"
        accept="image/*"
        onChange={event => {
          const file = event.target.files?.[0];
          if (file) setPreview(URL.createObjectURL(file));
        }}
      />
      <p className={styles.photoCaption}>{caption}</p>
    </div>
  );
}
