// Modell fürs Hintergrund-Entfernen; von Worker und Dialog (Hinweis mit Link) gemeinsam genutzt.
// Gleiche Gewichte wie onnx-community/BiRefNet_lite-ONNX (MIT), Graph umgebaut für die WebGPU-Grenzen
// (höchstens 8 Speicherpuffer je Shader, kein int64). Auf einen festen Stand gepinnt.
export const MODEL_ID = 'wonfy/BiRefNet_lite-ONNX-webgpu';
export const MODEL_REVISION = 'c40eaa22fb1af9edcf75c7b79d25ed8a8e901140';
export const MODEL_URL = `https://huggingface.co/${MODEL_ID}/tree/${MODEL_REVISION}`;
