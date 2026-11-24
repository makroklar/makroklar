import type { Device, WorkerRequest, WorkerResponse } from './backgroundRemoval.worker';

export type { Device };

export type RemovalStatus =
  | { phase: 'loading'; device: Device | null; progress: number | null }
  | { phase: 'running'; device: Device };

// Merkt sich, dass WebGPU auf diesem Gerät nicht klappt, damit nicht jedes Mal erst die GPU versucht wird
const CPU_KEY = 'makroklar:hintergrund-cpu';

function readCpuOnly() {
  try { return localStorage.getItem(CPU_KEY) === '1'; } catch { return false; }
}

function rememberCpuOnly() {
  try { localStorage.setItem(CPU_KEY, '1'); } catch { /* ohne Speicher eben nur für diese Sitzung */ }
}

let worker: Worker | null = null;
let cpuOnly: boolean | null = null;
let nextId = 0;

// Ein Worker für die ganze Seite: das Modell bleibt nach dem ersten Laden im Speicher
function getWorker() {
  worker ??= new Worker(new URL('./backgroundRemoval.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

function attempt(image: Blob, onStatus: (status: RemovalStatus) => void) {
  const target = getWorker();
  const id = ++nextId;
  return new Promise<{ image: Blob; device: Device }>((resolve, reject) => {
    const onMessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === 'loading') onStatus({ phase: 'loading', device: message.device, progress: message.progress });
      else if (message.type === 'running') onStatus({ phase: 'running', device: message.device });
      else if (message.id === id) {
        target.removeEventListener('message', onMessage);
        if (message.type === 'done') resolve({ image: message.image, device: message.device });
        else reject(Object.assign(new Error(message.message), { gpuFailed: message.gpuFailed }));
      }
    };
    target.addEventListener('message', onMessage);
    target.postMessage({ id, image, cpuOnly: cpuOnly ?? false } satisfies WorkerRequest);
  });
}

/** Entfernt den Hintergrund lokal im Browser und liefert ein PNG mit Alphakanal */
export async function removeBackground(image: Blob, onStatus: (status: RemovalStatus) => void) {
  cpuOnly ??= readCpuOnly();
  try {
    return await attempt(image, onStatus);
  } catch (error) {
    if (!(error instanceof Error && 'gpuFailed' in error && error.gpuFailed)) throw error;
    // WebGPU gescheitert: neuer Worker nur mit WebAssembly, die alte ONNX-Laufzeit hängt an der GPU
    console.warn('Hintergrund entfernen: WebGPU gescheitert, weiter auf dem Prozessor', error);
    worker?.terminate();
    worker = null;
    cpuOnly = true;
    rememberCpuOnly();
    return attempt(image, onStatus);
  }
}
