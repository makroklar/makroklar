// Modelle fürs Hintergrund-Entfernen; von Worker und Dialog (Hinweis mit Link) gemeinsam genutzt.
// Beide auf einen festen Stand gepinnt.

export type Device = 'webgpu' | 'wasm';

export interface BackgroundModel {
  id: string;
  revision: string;
  /** Name im Hinweis vor dem ersten Download */
  name: string;
  /** Ungefähre Downloadgröße für den Hinweis */
  size: string;
}

export const BACKGROUND_MODELS: Record<Device, BackgroundModel> = {
  // Grafikkarte: BiRefNet-lite (MIT), beste Qualität. Gleiche Gewichte wie onnx-community/BiRefNet_lite-ONNX,
  // Graph umgebaut für die WebGPU-Grenzen (höchstens 8 Speicherpuffer je Shader, kein int64).
  webgpu: {
    id: 'wonfy/BiRefNet_lite-ONNX-webgpu',
    revision: 'c40eaa22fb1af9edcf75c7b79d25ed8a8e901140',
    name: 'BiRefNet-lite',
    size: 'ca. 120–240 MB',
  },
  // Prozessor: ORMBG (Apache-2.0), IS-Net auf frei lizenzierten Daten, 8-Bit-quantisiert.
  // Klein genug für den WebAssembly-Speicher; BiRefNet passt dort nicht hinein.
  wasm: {
    id: 'onnx-community/ormbg-ONNX',
    revision: '034e2d884afbab897e10e78fc5bb566b29533fd6',
    name: 'ORMBG',
    size: 'ca. 42 MB',
  },
};

export const modelPageUrl = ({ id, revision }: BackgroundModel) => `https://huggingface.co/${id}/tree/${revision}`;
