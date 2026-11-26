// Hintergrund entfernen, komplett im Browser über transformers.js:
// - Grafikkarte (WebGPU): BiRefNet-lite (MIT), schnell und am genauesten
// - Prozessor (WebAssembly): ORMBG (Apache-2.0), klein genug für den WebAssembly-Speicher, dafür langsamer
// Welcher Weg genommen wird, entscheidet die Seite (siehe removeBackground.ts).
import { AutoModel, RawImage, Tensor, env, type PreTrainedModel } from '@huggingface/transformers';
import { BACKGROUND_MODELS, type Device } from './backgroundModel';

export type { Device };

// Beide Modelle erwarten fest 1024 × 1024 Pixel
const INPUT_SIZE = 1024;

interface ModelSetup {
  dtype: (adapterHasF16: boolean) => 'fp16' | 'fp32' | 'q8';
  input: string;
  output: string;
  /** Normalisierung nach dem Teilen durch 255 */
  mean: number[];
  std: number[];
  /** Ausgabe sind Logits (Sigmoid nötig) statt schon Werte von 0 bis 1 */
  logits: boolean;
}

const SETUP: Record<Device, ModelSetup> = {
  webgpu: {
    dtype: f16 => (f16 ? 'fp16' : 'fp32'),
    input: 'input_image',
    output: 'output_image',
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    logits: true,
  },
  wasm: {
    dtype: () => 'q8',
    input: 'pixel_values',
    output: 'alphas',
    mean: [0, 0, 0],
    std: [1, 1, 1],
    logits: false,
  },
};

export type WorkerRequest = { id: number; image: Blob; device: Device };
export type WorkerResponse =
  | { type: 'loading'; device: Device; progress: number | null }
  | { type: 'running'; device: Device }
  | { type: 'done'; id: number; image: Blob }
  | { type: 'error'; id: number; message: string; gpuFailed: boolean };

// Minimaler Typ für navigator.gpu, damit keine eigenen WebGPU-Typen nötig sind
type GpuNavigator = { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } };

env.allowLocalModels = false;

const post = (message: WorkerResponse) => self.postMessage(message);

async function load(device: Device): Promise<PreTrainedModel> {
  post({ type: 'loading', device, progress: null });
  let f16 = false;
  if (device === 'webgpu') {
    const adapter = await (navigator as GpuNavigator).gpu?.requestAdapter().catch(() => null);
    if (!adapter) throw new Error('WebGPU nicht verfügbar');
    f16 = adapter.features.has('shader-f16');
  }
  const progress_callback = (info: { status: string; progress?: number }) => {
    if (info.status === 'progress_total' && typeof info.progress === 'number') {
      post({ type: 'loading', device, progress: info.progress });
    }
  };
  const { id, revision } = BACKGROUND_MODELS[device];
  return AutoModel.from_pretrained(id, { revision, device, dtype: SETUP[device].dtype(f16), progress_callback });
}

// Je Gerät höchstens ein Modell; ein Worker nutzt in der Praxis nur eines
const loading = new Map<Device, Promise<PreTrainedModel>>();

function ready(device: Device): Promise<PreTrainedModel> {
  let model = loading.get(device);
  if (!model) {
    model = load(device);
    loading.set(device, model);
    model.catch(() => loading.delete(device));
  }
  return model;
}

/** Quadratisch skalieren und normalisieren wie beim Training, Layout 1×3×H×W */
async function toInput(image: RawImage, { mean, std }: ModelSetup): Promise<Tensor> {
  const { data } = await image.rgb().resize(INPUT_SIZE, INPUT_SIZE);
  const plane = INPUT_SIZE * INPUT_SIZE;
  const values = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i += 1) {
    for (let c = 0; c < 3; c += 1) values[c * plane + i] = (data[i * 3 + c] / 255 - mean[c]) / std[c];
  }
  return new Tensor('float32', values, [1, 3, INPUT_SIZE, INPUT_SIZE]);
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

async function cutout(model: PreTrainedModel, setup: ModelSetup, blob: Blob): Promise<Blob> {
  const image = await RawImage.fromBlob(blob);
  const input = await toInput(image, setup);
  const output = (await model({ [setup.input]: input })) as Record<string, Tensor>;
  let probabilities = output[setup.output].squeeze(0);
  if (setup.logits) probabilities = probabilities.sigmoid();
  const raw = probabilities.mul(255).to('uint8');
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

// Anfragen nacheinander abarbeiten, damit das Modell nicht doppelt rechnet
let queue = Promise.resolve();

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { id, image, device } = event.data;
  queue = queue.then(async () => {
    let decoded = false;
    try {
      // Nicht lesbare Bilder vorher abfangen, damit sie nicht als WebGPU-Fehler gelten
      (await createImageBitmap(image)).close();
      decoded = true;
      const model = await ready(device);
      post({ type: 'running', device });
      post({ type: 'done', id, image: await cutout(model, SETUP[device], image) });
    } catch (error) {
      post({
        type: 'error',
        id,
        message: error instanceof Error ? error.message : String(error),
        gpuFailed: decoded && device === 'webgpu',
      });
    }
  });
});
