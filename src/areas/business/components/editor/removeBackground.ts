import type { Device, WorkerRequest, WorkerResponse } from './backgroundRemoval.worker';

export type { Device };

export type RemovalStatus =
  | { phase: 'loading'; device: Device; progress: number | null }
  | { phase: 'running'; device: Device };

// Merkt sich, dass WebGPU auf diesem Gerät scheitert (z. B. Grafikkarten-Limits); dann gleich den Prozessor nehmen
const GPU_FAILED_KEY = 'makroklar:hintergrund-gpu-gescheitert';

let worker: Worker | null = null;
let nextId = 0;

function gpuFailedBefore() {
  try { return localStorage.getItem(GPU_FAILED_KEY) === '1'; } catch { return false; }
}

/**
 * Womit der Hintergrund entfernt wird, oder null, wenn der Browser es gar nicht kann.
 * - Grafikkarte (WebGPU): nur in sicherer Herkunft (https, localhost) und mit passender Grafikkarte.
 * - Sonst der Prozessor mit einem kleineren Modell, z. B. über http:// im WLAN.
 *
 * Firefox nimmt immer den Prozessor (Stand Firefox 160, ONNX Runtime 1.31–1.33): Das WebGPU-Backend
 * scheitert dort am Shader „Pad“ bzw. an ungültigen Puffern. Erneut prüfen, wenn das behoben ist.
 */
export async function backgroundRemovalDevice(): Promise<Device | null> {
  if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') return null;
  if (!window.isSecureContext || /\bFirefox\//.test(navigator.userAgent) || gpuFailedBefore()) return 'wasm';
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  return (await gpu?.requestAdapter().catch(() => null)) ? 'webgpu' : 'wasm';
}

// Ein Worker für die ganze Seite: das Modell bleibt nach dem ersten Laden im Speicher
function getWorker() {
  worker ??= new Worker(new URL('./backgroundRemoval.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

function attempt(image: Blob, device: Device, onStatus: (status: RemovalStatus) => void) {
  const target = getWorker();
  const id = ++nextId;
  return new Promise<Blob>((resolve, reject) => {
    const onMessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === 'loading') onStatus({ phase: 'loading', device: message.device, progress: message.progress });
      else if (message.type === 'running') onStatus({ phase: 'running', device: message.device });
      else if (message.id === id) {
        target.removeEventListener('message', onMessage);
        if (message.type === 'done') resolve(message.image);
        else reject(Object.assign(new Error(message.message), { gpuFailed: message.gpuFailed }));
      }
    };
    target.addEventListener('message', onMessage);
    target.postMessage({ id, image, device } satisfies WorkerRequest);
  });
}

/** Entfernt den Hintergrund lokal im Browser und liefert ein PNG mit Alphakanal */
export async function removeBackground(image: Blob, device: Device, onStatus: (status: RemovalStatus) => void) {
  try {
    return await attempt(image, device, onStatus);
  } catch (error) {
    if (!(error instanceof Error && 'gpuFailed' in error && error.gpuFailed)) throw error;
    // WebGPU gescheitert: neuer Worker auf dem Prozessor, die alte ONNX-Laufzeit hängt an der Grafikkarte
    console.warn('Hintergrund entfernen: WebGPU gescheitert, weiter auf dem Prozessor', error);
    try { localStorage.setItem(GPU_FAILED_KEY, '1'); } catch { /* dann eben nur für diese Sitzung */ }
    worker?.terminate();
    worker = null;
    return attempt(image, 'wasm', onStatus);
  }
}
