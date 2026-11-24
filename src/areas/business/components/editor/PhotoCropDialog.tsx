'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { Crop, Eraser, LoaderCircle, Paintbrush, Undo, WandSparkles, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { RemovalStatus } from './removeBackground';
import { MODEL_URL } from './backgroundModel';
import ui from '../dashboard/Dashboard.module.css';
import styles from './PhotoCropDialog.module.css';

/** Zoomfaktor und Mittelpunkt des Ausschnitts (0–1, relativ zum Bild) */
export interface CropState {
  zoom: number;
  cx: number;
  cy: number;
}

/** Ein Pinselstrich in Bildpixeln: Radierer macht durchsichtig, Pinsel malt das Original zurück */
export interface Stroke {
  tool: 'erase' | 'restore';
  radius: number;
  points: { x: number; y: number }[];
}

/** Seitenverhältnis des Foto-Felds (Breite : Höhe) */
export const PHOTO_ASPECT = 1.1;
const MAX_ZOOM = 4;
const OUTPUT_WIDTH = 1100;
const START: CropState = { zoom: 1, cx: 0.5, cy: 0.5 };
const BRUSH_MIN = 8;
const BRUSH_MAX = 80;

interface Size { w: number; h: number }

/** Zwei Bereiche: Ausschnitt wählen oder Hintergrund bearbeiten (automatisch und von Hand) */
type Mode = 'crop' | 'background';
type Tool = 'move' | 'erase' | 'restore';

const BRUSH_TOOLS = [
  { value: 'erase', label: 'Wegradieren', Icon: Eraser },
  { value: 'restore', label: 'Zurückmalen', Icon: Paintbrush },
] as const;

const TOOL_HINTS: Record<Tool, string> = {
  move: 'Ziehen zum Verschieben, Regler oder Mausrad zum Zoomen.',
  erase: 'Über Stellen malen, die verschwinden sollen. Mausrad zoomt.',
  restore: 'Über Stellen malen, die wieder sichtbar sein sollen. Mausrad zoomt.',
};

interface PhotoCropDialogProps {
  open: boolean;
  src: string | null;
  initial: CropState | null;
  /** Bild kann transparent sein: als WebP statt JPEG exportieren, damit der Alphakanal bleibt */
  transparent: boolean;
  /** Freigestellte Fassung des Bilds (PNG), falls schon berechnet */
  cutout: string | null;
  /** Beim Öffnen die freigestellte Fassung zeigen */
  initialUseCutout: boolean;
  /** Radierer- und Pinselstriche aus der letzten Bearbeitung */
  initialStrokes: Stroke[];
  /** false: kein WebGPU (z. B. über http://), dann gibt es den Knopf gar nicht */
  canRemoveBackground: boolean;
  removal: RemovalStatus | null;
  removalError: string | null;
  onRemoveBackground: () => void;
  onApply: (result: { url: string; crop: CropState; useCutout: boolean; strokes: Stroke[] }) => void;
  onClose: () => void;
}

function removalText(status: RemovalStatus) {
  if (status.phase === 'running') return 'Hintergrund wird lokal entfernt (GPU) …';
  return status.progress === null
    ? 'Modell wird vorbereitet …'
    : `Modell wird geladen: ${Math.round(status.progress)} %`;
}

/** Hartes Limit für das gespeicherte Foto; normal liegt es weit darunter (meist 0,1–0,5 MB) */
const MAX_BYTES = 5 * 1024 * 1024;

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));

/**
 * Kodieren und, falls nötig, so lange nachkomprimieren, bis das Foto unter MAX_BYTES liegt:
 * erst die Qualität senken, dann die Maße verkleinern (der PNG-Ersatz in Safari kennt keine Qualität).
 */
async function encodeWithinLimit(draw: (width: number) => HTMLCanvasElement | null, startWidth: number, type: string) {
  let width = startWidth;
  for (;;) {
    const canvas = draw(width);
    if (!canvas) return null;
    for (const quality of [0.9, 0.8, 0.7, 0.6]) {
      const blob = await toBlob(canvas, type, quality);
      if (!blob || blob.size <= MAX_BYTES) return blob;
      // Liefert der Browser PNG statt des gewünschten Formats, hilft weniger Qualität nicht
      if (blob.type !== type) break;
    }
    if (width <= 200) return toBlob(canvas, type, 0.5);
    width = Math.round(width * 0.8);
  }
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

function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke, original: CanvasPattern | null) {
  if (stroke.tool === 'restore' && !original) return;
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = stroke.radius * 2;
  if (stroke.tool === 'erase') {
    context.globalCompositeOperation = 'destination-out';
    context.strokeStyle = '#000';
  } else if (original) {
    // Original deckungsgleich als Muster: Leinwand und Original haben dieselben Pixelmaße
    context.strokeStyle = original;
  }
  context.beginPath();
  const [first, ...rest] = stroke.points;
  context.moveTo(first.x, first.y);
  // Ein einzelner Klick ist eine Linie der Länge 0; mit runden Enden wird daraus ein Punkt
  for (const point of rest.length > 0 ? rest : [first]) context.lineTo(point.x, point.y);
  context.stroke();
  context.restore();
}

// Overlay „Foto bearbeiten“: verschieben (Ziehen, Pfeiltasten), zoomen (Regler, Mausrad, +/−),
// radieren und mit dem Pinsel das Original zurückmalen
export function PhotoCropDialog({
  open, src, initial, transparent, cutout, initialUseCutout, initialStrokes, canRemoveBackground, removal, removalError,
  onRemoveBackground, onApply, onClose,
}: PhotoCropDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const originalRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const painting = useRef<Stroke | null>(null);
  const pressedBackdrop = useRef(false);
  const [image, setImage] = useState<Size | null>(null);
  const [originalReady, setOriginalReady] = useState(false);
  const [stageWidth, setStageWidth] = useState(0);
  const [crop, setCrop] = useState<CropState>(START);
  const [saving, setSaving] = useState(false);
  const [useCutout, setUseCutout] = useState(false);
  const [mode, setMode] = useState<Mode>('crop');
  const [brushTool, setBrushTool] = useState<'erase' | 'restore'>('erase');
  const tool: Tool = mode === 'crop' ? 'move' : brushTool;
  const [brush, setBrush] = useState(28);
  const [strokes, setStrokes] = useState<Stroke[]>([]);

  // Freigestellt nur zeigen, wenn die Fassung schon da ist; bis dahin das Original
  const shownSrc = useCutout && cutout ? cutout : src;
  const exportTransparent = transparent || shownSrc === cutout || strokes.some(stroke => stroke.tool === 'erase');

  const stage: Size = { w: stageWidth, h: stageWidth / PHOTO_ASPECT };
  const ready = image !== null && stageWidth > 0;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setCrop(initial ?? START);
      setUseCutout(initialUseCutout);
      setStrokes(initialStrokes);
      setMode('crop');
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, initial, initialUseCutout, initialStrokes]);

  // Neues Foto: alte Maße verwerfen
  useEffect(() => { setImage(null); }, [src]);

  // Originalgröße laden, damit Ausschnitt und Export in echten Bildpixeln rechnen
  useEffect(() => {
    // Beim Wechsel Original ↔ freigestellt bleiben die Maße gleich, daher altes Bild bis zum Laden stehen lassen
    if (!shownSrc) { setImage(null); return; }
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImage({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = shownSrc;
  }, [shownSrc]);

  // Original für den Pinsel, der Weggeschnittenes zurückmalt
  useEffect(() => {
    setOriginalReady(false);
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      originalRef.current = img;
      setOriginalReady(true);
    };
    img.src = src;
  }, [src]);

  const originalPattern = useCallback((context: CanvasRenderingContext2D) => (
    originalReady && originalRef.current ? context.createPattern(originalRef.current, 'no-repeat') : null
  ), [originalReady]);

  // Leinwand = Bild (Original oder freigestellt) plus alle Striche, in voller Auflösung
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !image) return;
    if (canvas.width !== image.w || canvas.height !== image.h) {
      canvas.width = image.w;
      canvas.height = image.h;
    }
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0);
    const pattern = originalPattern(context);
    for (const stroke of strokes) drawStroke(context, stroke, pattern);
  }, [image, strokes, originalPattern]);

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

  /** Bildschirmpunkt → Bildpixel, passend zu Verschiebung und Zoom der Leinwand */
  function toImage(event: PointerEvent<HTMLDivElement>) {
    if (!image) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const { scale, width, height } = geometry(stage, image, crop.zoom);
    const left = stage.w / 2 - crop.cx * width;
    const top = stage.h / 2 - crop.cy * height;
    return { x: (event.clientX - rect.left - left) / scale, y: (event.clientY - rect.top - top) / scale, scale };
  }

  // Kreis in Pinselgröße folgt der Maus; direkt am Element, damit nicht bei jeder Bewegung neu gerendert wird
  function moveCursor(event: PointerEvent<HTMLDivElement>) {
    const cursor = cursorRef.current;
    if (!cursor) return;
    const rect = event.currentTarget.getBoundingClientRect();
    cursor.style.translate = `${event.clientX - rect.left - brush / 2}px ${event.clientY - rect.top - brush / 2}px`;
    cursor.style.opacity = '1';
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === 'move') {
      drag.current = { x: event.clientX, y: event.clientY };
      return;
    }
    const point = toImage(event);
    const context = canvasRef.current?.getContext('2d');
    if (!point || !context) return;
    painting.current = { tool, radius: brush / 2 / point.scale, points: [{ x: point.x, y: point.y }] };
    drawStroke(context, painting.current, originalPattern(context));
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (tool !== 'move') moveCursor(event);
    if (drag.current) {
      pan(event.clientX - drag.current.x, event.clientY - drag.current.y);
      drag.current = { x: event.clientX, y: event.clientY };
      return;
    }
    const stroke = painting.current;
    const point = toImage(event);
    const context = canvasRef.current?.getContext('2d');
    if (!stroke || !point || !context) return;
    // Nur das neue Stück zeichnen; der ganze Strich wird beim Loslassen übernommen
    const last = stroke.points[stroke.points.length - 1];
    const next = { x: point.x, y: point.y };
    stroke.points.push(next);
    drawStroke(context, { ...stroke, points: [last, next] }, originalPattern(context));
  }

  function endPointer() {
    drag.current = null;
    const stroke = painting.current;
    painting.current = null;
    if (stroke) setStrokes(current => [...current, stroke]);
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

  async function apply() {
    const picture = canvasRef.current;
    if (!picture || !image || !ready) return;
    const { scale } = geometry(stage, image, crop.zoom);
    const sourceWidth = stage.w / scale;
    const sourceHeight = stage.h / scale;
    const draw = (width: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.round(width / PHOTO_ASPECT);
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.imageSmoothingQuality = 'high';
      context.drawImage(
        picture,
        crop.cx * image.w - sourceWidth / 2, crop.cy * image.h - sourceHeight / 2, sourceWidth, sourceHeight,
        0, 0, canvas.width, canvas.height,
      );
      return canvas;
    };
    setSaving(true);
    try {
      // Mit Transparenz WebP (deutlich kleiner als PNG); Browser ohne WebP-Export liefern automatisch PNG
      const blob = await encodeWithinLimit(draw, Math.min(OUTPUT_WIDTH, Math.round(sourceWidth)), exportTransparent ? 'image/webp' : 'image/jpeg');
      if (blob) onApply({ url: URL.createObjectURL(blob), crop, useCutout: shownSrc === cutout, strokes });
    } finally {
      setSaving(false);
    }
  }

  function toggleBackground() {
    if (useCutout) { setUseCutout(false); return; }
    setUseCutout(true);
    if (!cutout) onRemoveBackground();
  }

  const shown = ready ? geometry(stage, image, crop.zoom) : null;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="photo-crop-title"
      onClose={onClose}
      // Nur schließen, wenn der Klick auch auf dem Hintergrund begann; sonst schließt z. B.
      // ein Zoom-Regler, der über den Rand hinaus gezogen und dort losgelassen wird, den Dialog
      onPointerDown={event => { pressedBackdrop.current = event.target === event.currentTarget; }}
      onClick={event => { if (pressedBackdrop.current && event.target === event.currentTarget) onClose(); }}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <h2 id="photo-crop-title">Foto bearbeiten</h2>
          <button className={styles.close} type="button" aria-label="Schließen" onClick={onClose}>
            <X aria-hidden="true" size={28} />
          </button>
        </header>

        <div className={styles.preview}>
          <div
            ref={stageRef}
            className={styles.stage}
            data-tool={tool}
            tabIndex={0}
            aria-label="Bildausschnitt. Mit Ziehen oder den Pfeiltasten verschieben, mit Plus und Minus zoomen."
            aria-describedby="photo-crop-hint"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onPointerLeave={() => { if (cursorRef.current) cursorRef.current.style.opacity = '0'; }}
            onKeyDown={onKeyDown}
          >
            {/* Leinwand statt <img>: Radierer und Pinsel zeichnen direkt in voller Auflösung hinein */}
            <canvas
              ref={canvasRef}
              className={styles.picture}
              hidden={!shown}
              style={shown ? {
                width: shown.width,
                height: shown.height,
                transform: `translate(${stage.w / 2 - crop.cx * shown.width}px, ${stage.h / 2 - crop.cy * shown.height}px)`,
              } : undefined}
            />
            <span className={styles.grid} aria-hidden="true" />
            {tool !== 'move' && (
              <span ref={cursorRef} className={styles.brushCursor} style={{ width: brush, height: brush }} aria-hidden="true" />
            )}
            {removal && (
              <div className={styles.busy} aria-hidden="true">
                <LoaderCircle className={styles.spinner} size={28} />
              </div>
            )}
          </div>
          <p id="photo-crop-hint" className={styles.hint}>{TOOL_HINTS[tool]}</p>
        </div>

        <div className={styles.controls}>
          <div className={styles.tabs} role="tablist" aria-label="Bearbeiten">
            {([
              ['crop', 'Zuschneiden', Crop],
              ['background', 'Hintergrund', Eraser],
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                className={styles.tab}
                type="button"
                role="tab"
                id={`photo-tab-${value}`}
                aria-selected={mode === value}
                aria-controls={`photo-panel-${value}`}
                onClick={() => setMode(value)}
              >
                <Icon aria-hidden="true" size={18} />
                {label}
              </button>
            ))}
          </div>

          {/* Beide Reiter liegen übereinander in derselben Zelle; der inaktive ist nur unsichtbar.
              So ist die Fläche immer so hoch wie der höhere Reiter und beim Wechsel springt nichts. */}
          <div className={styles.panels}>
            <div id="photo-panel-crop" role="tabpanel" aria-labelledby="photo-tab-crop" className={styles.panel} data-active={mode === 'crop'} inert={mode !== 'crop'}>
              <label className={styles.zoom}>
                <ZoomOut aria-hidden="true" size={18} />
                <span className={ui.visuallyHidden}>Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={crop.zoom}
                  aria-valuetext={`${Math.round(crop.zoom * 100)} %`}
                  style={{ '--progress': (crop.zoom - 1) / (MAX_ZOOM - 1) } as CSSProperties}
                  onChange={event => update(current => ({ ...current, zoom: Number(event.target.value) }))}
                />
                <ZoomIn aria-hidden="true" size={18} />
              </label>
            </div>
            <div id="photo-panel-background" role="tabpanel" aria-labelledby="photo-tab-background" className={styles.panel} data-active={mode === 'background'} inert={mode !== 'background'}>
              {/* 1. Automatisch: KI stellt frei, als Schalter an/aus */}
              {canRemoveBackground && (
                <section className={styles.section}>
                  <label className={styles.switchRow}>
                    <WandSparkles className={styles.sectionIcon} aria-hidden="true" size={20} />
                    <span className={styles.switchText}>
                      <strong>Automatisch entfernen</strong>
                      <span role="status">
                        {removal ? removalText(removal) : 'Lokal im Browser, das Foto verlässt dein Gerät nicht.'}
                      </span>
                    </span>
                    <input
                      className={styles.switch}
                      type="checkbox"
                      role="switch"
                      checked={useCutout}
                      disabled={removal !== null}
                      onChange={toggleBackground}
                    />
                  </label>
                  {!cutout && !removal && (
                    <p className={styles.sectionNote}>
                      Beim ersten Mal lädt dein Browser dafür das KI-Modell{' '}
                      <a href={MODEL_URL} target="_blank" rel="noopener noreferrer">BiRefNet-lite</a>{' '}
                      <span className={styles.nowrap}>(ca. 120–240 MB)</span> von Hugging Face herunter.
                    </p>
                  )}
                  {removalError && <p className={styles.backgroundError} role="alert">{removalError}</p>}
                </section>
              )}

              {/* 2. Von Hand: wegradieren oder das Original zurückmalen */}
              <section className={styles.section}>
                <div className={styles.tools}>
                  <strong className={styles.sectionTitle}>Von Hand nachbessern</strong>
                  <button
                    className={`${styles.tool} ${styles.undo}`}
                    type="button"
                    aria-label="Rückgängig"
                    title="Letzten Strich rückgängig machen"
                    disabled={strokes.length === 0}
                    onClick={() => setStrokes(current => current.slice(0, -1))}
                  >
                    <Undo aria-hidden="true" size={18} />
                  </button>
                </div>
                <div className={styles.tools}>
                  <div className={styles.toolGroup} role="group" aria-label="Pinsel">
                    {BRUSH_TOOLS.map(({ value, label, Icon }) => (
                      <button
                        key={value}
                        className={styles.tool}
                        type="button"
                        aria-pressed={brushTool === value}
                        onClick={() => setBrushTool(value)}
                      >
                        <Icon aria-hidden="true" size={18} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                  <label className={styles.size}>
                    <span className={ui.visuallyHidden}>Pinselgröße</span>
                    <input
                      type="range"
                      min={BRUSH_MIN}
                      max={BRUSH_MAX}
                      step={1}
                      value={brush}
                      aria-valuetext={`${brush} Pixel`}
                      style={{ '--progress': (brush - BRUSH_MIN) / (BRUSH_MAX - BRUSH_MIN) } as CSSProperties}
                      onChange={event => setBrush(Number(event.target.value))}
                    />
                    <span className={styles.sizePreview} aria-hidden="true">
                      <span style={{ width: Math.max(4, brush / 3), height: Math.max(4, brush / 3) }} />
                    </span>
                  </label>
                </div>
              </section>
            </div>
          </div>

          <div className={styles.actions}>
            <button className={ui.secondaryButton} type="button" onClick={onClose}>Abbrechen</button>
            <button className={ui.primaryButton} type="button" disabled={!ready || saving || removal !== null} onClick={apply}>Übernehmen</button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
