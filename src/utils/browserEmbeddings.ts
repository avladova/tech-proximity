import { EmbeddingModelId } from '../types/proximity';
import { normalizeL2 } from './tfidf';

const VEC_CACHE_PREFIX = 'tech_prox_vec_v1:';

function hashText(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function getCachedVector(modelId: EmbeddingModelId, text: string): number[] | null {
  try {
    const raw = localStorage.getItem(`${VEC_CACHE_PREFIX}${modelId}:${hashText(text)}`);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

function setCachedVector(modelId: EmbeddingModelId, text: string, vec: number[]) {
  try {
    localStorage.setItem(`${VEC_CACHE_PREFIX}${modelId}:${hashText(text)}`, JSON.stringify(vec));
  } catch {
    // Ignore localStorage quota exceeded for large vectors
  }
}

// Keep at most 1 ONNX pipeline loaded in browser memory
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activePipe: any = null;
let activeModelId: EmbeddingModelId | null = null;

const HF_MODEL_MAP: Record<Exclude<EmbeddingModelId, 'tfidf'>, { repo: string; pooling: 'mean' | 'cls'; prefix: string }> = {
  'e5-small': {
    repo: 'Xenova/multilingual-e5-small',
    pooling: 'mean',
    prefix: 'passage: ',
  },
  'minilm-l12': {
    repo: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
    pooling: 'mean',
    prefix: '',
  },
  'bge-m3': {
    repo: 'onnx-community/bge-m3-ONNX',
    pooling: 'cls',
    prefix: '',
  },
};

export async function computeBrowserEmbeddings(
  modelId: Exclude<EmbeddingModelId, 'tfidf'>,
  items: { id: string; text: string }[],
  onProgress?: (percent: number, note: string) => void
): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  const missing: { id: string; text: string }[] = [];

  for (const item of items) {
    const clean = item.text.trim();
    if (!clean) continue;
    const cached = getCachedVector(modelId, clean);
    if (cached && cached.length > 0) {
      result.set(item.id, cached);
    } else {
      missing.push({ id: item.id, text: clean });
    }
  }

  if (missing.length === 0) {
    onProgress?.(100, 'Загружено из кэша браузера');
    return result;
  }

  const cfg = HF_MODEL_MAP[modelId];

  if (activeModelId !== modelId || !activePipe) {
    if (activePipe && typeof activePipe.dispose === 'function') {
      await activePipe.dispose();
    }
    activePipe = null;
    activeModelId = null;

    onProgress?.(5, `Загрузка весов ${cfg.repo} в кэш браузера...`);
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.numThreads = 1;
    }

    activePipe = await pipeline('feature-extraction', cfg.repo, {
      dtype: 'q8',
      progress_callback: (info: Record<string, unknown>) => {
        if (info.status === 'progress' && typeof info.progress === 'number') {
          onProgress?.(
            Math.max(5, Math.min(75, Math.round(info.progress * 0.75))),
            `Скачивание модели ${cfg.repo}: ${Math.round(info.progress)}%`
          );
        }
      },
    });
    activeModelId = modelId;
  }

  // Embed missing texts sequentially / small batches for smooth UI updates
  for (let i = 0; i < missing.length; i++) {
    const item = missing[i];
    const pct = 75 + Math.round(((i + 1) / missing.length) * 25);
    onProgress?.(pct, `Векторизация текстов: ${i + 1} из ${missing.length}`);

    const input = cfg.prefix ? `${cfg.prefix}${item.text}` : item.text;
    const output = await activePipe(input, { pooling: cfg.pooling, normalize: true });
    const rows = output.tolist() as number[][];
    const rawVec = Array.isArray(rows[0]) ? rows[0] : (rows as unknown as number[]);
    if (Array.isArray(rawVec) && rawVec.length > 0) {
      const normVec = normalizeL2(rawVec);
      setCachedVector(modelId, item.text, normVec);
      result.set(item.id, normVec);
    }
  }

  return result;
}
