// Hintergrund entfernen, komplett im Browser: BiRefNet-lite (MIT) über transformers.js.
// Mit WebGPU (sichere Herkunft: https oder localhost) rechnet die Grafikkarte, sonst WebAssembly auf dem Prozessor.
import { AutoModel, RawImage, Tensor, env, type PreTrainedModel } from '@huggingface/transformers';
import { MODEL_ID, MODEL_REVISION } from './backgroundModel';


// Das Modell erwartet fest 1024 × 1024 Pixel
const INPUT_SIZE = 1024;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

export type Device = 'webgpu' | 'wasm';

/** cpuOnly: WebGPU ist in diesem Browser schon gescheitert, direkt WebAssembly nehmen */
export type WorkerRequest = { id: number; image: Blob; cpuOnly: boolean };
export type WorkerResponse =
  | { type: 'loading'; device: Device; progress: number | null }
  | { type: 'running'; device: Device }
  | { type: 'done'; id: number; image: Blob; device: Device }
  | { type: 'error'; id: number; message: string; gpuFailed: boolean };

interface Loaded { model: PreTrainedModel; device: Device }

// Minimaler Typ für navigator.gpu, damit keine eigenen WebGPU-Typen nötig sind
type GpuNavigator = { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } };

env.allowLocalModels = false;

const post = (message: WorkerResponse) => self.postMessage(message);

type Dtype = 'fp16' | 'fp32';
interface Config { device: Device; dtype: Dtype }

const CPU: Config = { device: 'wasm', dtype: 'fp32' };

/** WebGPU nur in sicherer Herkunft (https, localhost) und mit Grafikkarte; sonst WebAssembly */
async function pickConfig(cpuOnly: boolean): Promise<Config> {
  if (cpuOnly || !self.isSecureContext) return CPU;
  const adapter = await (navigator as GpuNavigator).gpu?.requestAdapter().catch(() => null);
  if (!adapter) return CPU;
  return { device: 'webgpu', dtype: adapter.features.has('shader-f16') ? 'fp16' : 'fp32' };
}

async function load({ device, dtype }: Config): Promise<Loaded> {
  post({ type: 'loading', device, progress: null });
  const progress_callback = (info: { status: string; progress?: number }) => {
    if (info.status === 'progress_total' && typeof info.progress === 'number') {
      post({ type: 'loading', device, progress: info.progress });
    }
  };
  // Auf dem Prozessor ohne Speicher-Arena und Speichermuster: weniger Spitzenbedarf im WebAssembly-Speicher
  const session_options = device === 'wasm' ? { enableCpuMemArena: false, enableMemPattern: false } : {};
  const model = await AutoModel.from_pretrained(MODEL_ID, { revision: MODEL_REVISION, device, dtype, progress_callback, session_options });
  return { model, device };
}

let loading: Promise<Loaded> | null = null;
let config: Config | null = null;

function ready(cpuOnly: boolean): Promise<Loaded> {
  loading ??= pickConfig(cpuOnly).then(picked => { config = picked; return load(picked); });
  loading.catch(() => { loading = null; });
  return loading;
}

/** Quadratisch skalieren und wie beim Training normalisieren (ImageNet-Mittelwerte), Layout 1×3×H×W */
async function toInput(image: RawImage, size: number): Promise<Tensor> {
  const { data } = await image.rgb().resize(size, size);
  const plane = size * size;
  const values = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i += 1) {
    for (let c = 0; c < 3; c += 1) values[c * plane + i] = (data[i * 3 + c] / 255 - MEAN[c]) / STD[c];
  }
  return new Tensor('float32', values, [1, 3, size, size]);
}

/**
 * Löcher in der Maske schließen: Als Hintergrund zählt nur, was mit dem Bildrand verbunden ist.
 * Das Modell schneidet sonst gern Flächen mitten im Gericht weg (z. B. Soße, die dem Tisch ähnelt).
 * Flutfüllung vom Rand über alle Pixel unter 50 %; was danach nicht erreicht wurde, wird Vordergrund.
 */
function fillHoles(mask: Uint8Array, width: number, height: number) {
  const THRESHOLD = 128;
  const reached = new Uint8Array(width * height);
  const stack: number[] = [];
  const visit = (i: number) => {
    if (!reached[i] && mask[i] < THRESHOLD) { reached[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < width; x += 1) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y += 1) { visit(y * width); visit(y * width + width - 1); }
  while (stack.length > 0) {
    const i = stack.pop()!;
    const x = i % width;
    if (x > 0) visit(i - 1);
    if (x < width - 1) visit(i + 1);
    if (i >= width) visit(i - width);
    if (i < width * (height - 1)) visit(i + width);
  }
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] < THRESHOLD && !reached[i]) mask[i] = 255;
  }
}

async function cutout({ model }: Loaded, blob: Blob): Promise<Blob> {
  const image = await RawImage.fromBlob(blob);
  const pixel_values = await toInput(image, INPUT_SIZE);
  const { output_image } = (await model({ input_image: pixel_values })) as { output_image: Tensor };
  const raw = output_image.squeeze(0).sigmoid().mul(255).to('uint8');
  fillHoles(raw.data as Uint8Array, INPUT_SIZE, INPUT_SIZE);
  const mask = await RawImage.fromTensor(raw).resize(image.width, image.height);

  // Maske als Alphakanal über das Original legen; vorhandene Transparenz bleibt erhalten
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas nicht verfügbar');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < mask.data.length; i += 1) {
    pixels.data[i * 4 + 3] = Math.round((pixels.data[i * 4 + 3] * mask.data[i]) / 255);
  }
  context.putImageData(pixels, 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

// Anfragen nacheinander abarbeiten, damit das Modell nicht doppelt rechnet.
// Scheitert WebGPU (z. B. Grafikkarten-Limits), meldet der Worker das; die Seite startet dann einen
// neuen Worker nur mit WebAssembly, weil die ONNX-Laufzeit hier schon auf WebGPU festgelegt ist.
let queue = Promise.resolve();

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { id, image, cpuOnly } = event.data;
  queue = queue.then(async () => {
    let decoded = false;
    try {
      // Nicht lesbare Bilder vorher abfangen, damit sie nicht als WebGPU-Fehler gelten
      (await createImageBitmap(image)).close();
      decoded = true;
      const loaded = await ready(cpuOnly);
      post({ type: 'running', device: loaded.device });
      post({ type: 'done', id, image: await cutout(loaded, image), device: loaded.device });
    } catch (error) {
      const gpuFailed = decoded && config?.device === 'webgpu';
      post({ type: 'error', id, message: error instanceof Error ? error.message : String(error), gpuFailed });
    }
  });
});
