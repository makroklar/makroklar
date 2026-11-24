import type { WorkerRequest, WorkerResponse } from './backgroundRemoval.worker';

export type RemovalStatus =
  | { phase: 'loading'; progress: number | null }
  | { phase: 'running' };

// Merkt sich, dass WebGPU auf diesem Gerät scheitert (z. B. Grafikkarten-Limits), damit der Knopf dann gar nicht erscheint
const UNSUPPORTED_KEY = 'makroklar:hintergrund-nicht-moeglich';

let worker: Worker | null = null;
let nextId = 0;

/**
 * Nur anbieten, wenn WebGPU nutzbar ist: Das gibt es nur in sicherer Herkunft (https, localhost)
 * und mit passender Grafikkarte. Auf dem Prozessor reicht der Speicher für das Modell nicht.
 */
export async function canRemoveBackground(): Promise<boolean> {
  if (!window.isSecureContext) return false;
  try { if (localStorage.getItem(UNSUPPORTED_KEY) === '1') return false; } catch { /* ohne Speicher einfach prüfen */ }
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  return Boolean(await gpu?.requestAdapter().catch(() => null));
}

// Ein Worker für die ganze Seite: das Modell bleibt nach dem ersten Laden im Speicher
function getWorker() {
  worker ??= new Worker(new URL('./backgroundRemoval.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

/** Entfernt den Hintergrund lokal im Browser und liefert ein PNG mit Alphakanal */
export function removeBackground(image: Blob, onStatus: (status: RemovalStatus) => void): Promise<Blob> {
  const target = getWorker();
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === 'loading') onStatus({ phase: 'loading', progress: message.progress });
      else if (message.type === 'running') onStatus({ phase: 'running' });
      else if (message.id === id) {
        target.removeEventListener('message', onMessage);
        if (message.type === 'done') { resolve(message.image); return; }
        if (message.gpuFailed) {
          try { localStorage.setItem(UNSUPPORTED_KEY, '1'); } catch { /* dann eben nur für diese Sitzung */ }
        }
        reject(new Error(message.message));
      }
    };
    target.addEventListener('message', onMessage);
    target.postMessage({ id, image } satisfies WorkerRequest);
  });
}
