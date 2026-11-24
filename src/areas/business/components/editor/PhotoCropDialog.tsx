'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import ui from '../dashboard/Dashboard.module.css';
import styles from './PhotoCropDialog.module.css';

/** Zoomfaktor und Mittelpunkt des Ausschnitts (0–1, relativ zum Bild) */
export interface CropState {
  zoom: number;
  cx: number;
  cy: number;
}

/** Seitenverhältnis des Foto-Felds (Breite : Höhe) */
export const PHOTO_ASPECT = 1.1;
const MAX_ZOOM = 4;
const OUTPUT_WIDTH = 1100;
const START: CropState = { zoom: 1, cx: 0.5, cy: 0.5 };

interface Size { w: number; h: number }

interface PhotoCropDialogProps {
  open: boolean;
  src: string | null;
  initial: CropState | null;
  onApply: (result: { url: string; crop: CropState }) => void;
  onClose: () => void;
}

/** Bildgröße auf der Fläche: füllt den Ausschnitt mindestens ganz aus („cover“), dann gezoomt */
function geometry(stage: Size, image: Size, zoom: number) {
  const scale = Math.max(stage.w / image.w, stage.h / image.h) * zoom;
  return { scale, width: image.w * scale, height: image.h * scale };
}

/** Ausschnitt so begrenzen, dass er nie über den Bildrand hinausgeht */
function clamp(crop: CropState, stage: Size, image: Size): CropState {
  const zoom = Math.min(Math.max(crop.zoom, 1), MAX_ZOOM);
  const { width, height } = geometry(stage, image, zoom);
  const halfX = stage.w / 2 / width;
  const halfY = stage.h / 2 / height;
  return {
    zoom,
    cx: Math.min(Math.max(crop.cx, halfX), 1 - halfX),
    cy: Math.min(Math.max(crop.cy, halfY), 1 - halfY),
  };
}

// Overlay „Foto zuschneiden“: Bild verschieben (Ziehen, Pfeiltasten) und zoomen (Regler, Mausrad, +/−)
export function PhotoCropDialog({ open, src, initial, onApply, onClose }: PhotoCropDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [image, setImage] = useState<Size | null>(null);
  const [stageWidth, setStageWidth] = useState(0);
  const [crop, setCrop] = useState<CropState>(START);
  const [saving, setSaving] = useState(false);

  const stage: Size = { w: stageWidth, h: stageWidth / PHOTO_ASPECT };
  const ready = image !== null && stageWidth > 0;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setCrop(initial ?? START);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, initial]);

  // Originalgröße laden, damit Ausschnitt und Export in echten Bildpixeln rechnen
  useEffect(() => {
    setImage(null);
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImage({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = src;
  }, [src]);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const update = useCallback((change: (current: CropState) => CropState) => {
    if (!image || stageWidth === 0) return;
    const size = { w: stageWidth, h: stageWidth / PHOTO_ASPECT };
    setCrop(current => clamp(change(current), size, image));
  }, [image, stageWidth]);

  // Mausrad zoomt; als nativer Listener, damit preventDefault die Seite nicht scrollen lässt
  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      update(current => ({ ...current, zoom: current.zoom * Math.exp(-event.deltaY * 0.0015) }));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [update]);

  function pan(dx: number, dy: number) {
    if (!image) return;
    update(current => {
      const { width, height } = geometry(stage, image, current.zoom);
      return { ...current, cx: current.cx - dx / width, cy: current.cy - dy / height };
    });
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    pan(event.clientX - drag.current.x, event.clientY - drag.current.y);
    drag.current = { x: event.clientX, y: event.clientY };
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 40 : 10;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step],
    };
    if (moves[event.key]) pan(...moves[event.key]);
    else if (event.key === '+' || event.key === '=') update(current => ({ ...current, zoom: current.zoom * 1.1 }));
    else if (event.key === '-') update(current => ({ ...current, zoom: current.zoom / 1.1 }));
    else return;
    event.preventDefault();
  }

  function apply() {
    const img = imageRef.current;
    if (!img || !image || !ready) return;
    const { scale } = geometry(stage, image, crop.zoom);
    const sourceWidth = stage.w / scale;
    const sourceHeight = stage.h / scale;
    const width = Math.min(OUTPUT_WIDTH, Math.round(sourceWidth));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.round(width / PHOTO_ASPECT);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      img,
      crop.cx * image.w - sourceWidth / 2, crop.cy * image.h - sourceHeight / 2, sourceWidth, sourceHeight,
      0, 0, canvas.width, canvas.height,
    );
    setSaving(true);
    canvas.toBlob(blob => {
      setSaving(false);
      if (blob) onApply({ url: URL.createObjectURL(blob), crop });
    }, 'image/jpeg', 0.9);
  }

  const shown = ready ? geometry(stage, image, crop.zoom) : null;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="photo-crop-title"
      onClose={onClose}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <h2 id="photo-crop-title">Foto zuschneiden</h2>
          <button className={styles.close} type="button" aria-label="Schließen" onClick={onClose}>
            <X aria-hidden="true" size={28} />
          </button>
        </header>

        <div
          ref={stageRef}
          className={styles.stage}
          tabIndex={0}
          aria-label="Bildausschnitt. Mit Ziehen oder den Pfeiltasten verschieben, mit Plus und Minus zoomen."
          aria-describedby="photo-crop-hint"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          onKeyDown={onKeyDown}
        >
          {src && shown && (
            // Bewusst <img>: lokale blob:-Vorschau, dafür passt next/image nicht
            <img
              src={src}
              alt=""
              draggable={false}
              style={{
                width: shown.width,
                height: shown.height,
                transform: `translate(${stage.w / 2 - crop.cx * shown.width}px, ${stage.h / 2 - crop.cy * shown.height}px)`,
              }}
            />
          )}
          <span className={styles.grid} aria-hidden="true" />
        </div>
        <p id="photo-crop-hint" className={styles.hint}>So sehen Gäste das Foto. Ziehen zum Verschieben, Regler oder Mausrad zum Zoomen.</p>

        <label className={styles.zoom}>
          <ZoomOut aria-hidden="true" size={18} />
          <span className={ui.visuallyHidden}>Zoom</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={crop.zoom}
            onChange={event => update(current => ({ ...current, zoom: Number(event.target.value) }))}
          />
          <ZoomIn aria-hidden="true" size={18} />
        </label>

        <div className={styles.actions}>
          <button className={ui.secondaryButton} type="button" onClick={onClose}>Abbrechen</button>
          <button className={ui.primaryButton} type="button" disabled={!ready || saving} onClick={apply}>Übernehmen</button>
        </div>
      </div>
    </dialog>
  );
}
