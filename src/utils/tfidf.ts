export interface TfidfCorpusModel {
  vocab: Map<string, number>;
  idf: Float64Array;
  dim: number;
}

const STOP_WORDS = new Set([
  'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то', 'все',
  'она', 'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за', 'бы', 'по',
  'только', 'ее', 'мне', 'было', 'вот', 'от', 'меня', 'еще', 'нет', 'о', 'из', 'ему',
  'теперь', 'когда', 'даже', 'ну', 'вдруг', 'ли', 'если', 'уже', 'или', 'ни', 'быть',
  'был', 'него', 'до', 'вас', 'нибудь', 'опять', 'уж', 'вам', 'ведь', 'там', 'потом',
  'себя', 'ничего', 'ей', 'может', 'они', 'тут', 'где', 'есть', 'надо', 'ней', 'для',
  'мы', 'тебя', 'их', 'чем', 'была', 'сам', 'чтоб', 'без', 'будто', 'чего', 'раз',
  'тоже', 'себе', 'под', 'будет', 'ж', 'тогда', 'кто', 'этот', 'того', 'потому',
  'этого', 'какой', 'совсем', 'ним', 'здесь', 'этом', 'один', 'почти', 'мой', 'тем',
  'чтобы', 'нее', 'сейчас', 'были', 'куда', 'зачем', 'всех', 'никогда', 'можно',
  'при', 'наконец', 'два', 'об', 'другой', 'хоть', 'после', 'над', 'больше', 'тот',
  'через', 'эти', 'нас', 'про', 'всего', 'них', 'какая', 'много', 'разве', 'три',
  'эту', 'моя', 'впрочем', 'хорошо', 'свою', 'этой', 'перед', 'иногда', 'лучше',
  'чуть', 'том', 'нельзя', 'такой', 'им', 'более', 'всегда', 'конечно', 'всю', 'между',
  'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'are', 'was',
  'проблема', 'метод', 'отрасль', 'класс', 'технологии', 'разработчик', 'собственные', 'силы', 'банка'
]);

/**
 * Extracts normalized word stems (light suffix trim for RU/EN) + character 3..5-grams
 * so Russian inflections (платеж/платежи/платежный) share rich geometric overlap.
 */
export function tokenizeForVectorization(text: string): string[] {
  const cleaned = (text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\-\s]/g, ' ');

  const rawWords = cleaned.split(/\s+/).filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  const tokens: string[] = [];

  for (const word of rawWords) {
    // Full word & light prefix stem
    tokens.push(`w:${word}`);
    if (word.length >= 5) {
      tokens.push(`s:${word.slice(0, Math.max(4, word.length - 2))}`);
    }
    // Char n-grams (3 and 4) inside word boundaries for Russian morphology robustness
    const padded = `_${word}_`;
    if (padded.length >= 4) {
      for (let i = 0; i <= padded.length - 3; i++) {
        tokens.push(`c3:${padded.slice(i, i + 3)}`);
      }
    }
    if (padded.length >= 5) {
      for (let i = 0; i <= padded.length - 4; i++) {
        tokens.push(`c4:${padded.slice(i, i + 4)}`);
      }
    }
  }
  return tokens;
}

export function buildTfidfCorpus(documents: string[]): TfidfCorpusModel {
  const docFreq = new Map<string, number>();
  const tokenizedDocs = documents.map((doc) => tokenizeForVectorization(doc));

  for (const tokens of tokenizedDocs) {
    const unique = new Set(tokens);
    for (const t of unique) {
      docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
    }
  }

  const vocab = new Map<string, number>();
  const idfList: number[] = [];
  const N = Math.max(1, documents.length);

  let idx = 0;
  for (const [term, df] of docFreq.entries()) {
    // Filter ultra-rare single-char artifacts if corpus is large, keep meaningful terms
    if (df >= 1) {
      vocab.set(term, idx);
      idfList.push(Math.log((1 + N) / (1 + df)) + 1);
      idx++;
    }
  }

  return {
    vocab,
    idf: Float64Array.from(idfList),
    dim: idx,
  };
}

export function vectorizeTfidf(text: string, model: TfidfCorpusModel): number[] {
  const vec = new Float64Array(model.dim);
  const tokens = tokenizeForVectorization(text);
  if (tokens.length === 0 || model.dim === 0) {
    return Array.from(vec);
  }

  const counts = new Map<number, number>();
  for (const t of tokens) {
    const idx = model.vocab.get(t);
    if (idx !== undefined) {
      counts.set(idx, (counts.get(idx) ?? 0) + 1);
    }
  }

  let normSq = 0;
  for (const [idx, count] of counts.entries()) {
    const tf = 1 + Math.log(count);
    const val = tf * model.idf[idx];
    vec[idx] = val;
    normSq += val * val;
  }

  const norm = Math.sqrt(normSq);
  if (norm > 1e-12) {
    for (let i = 0; i < vec.length; i++) {
      vec[i] /= norm;
    }
  }

  return Array.from(vec);
}

export function normalizeL2(vec: number[]): number[] {
  let normSq = 0;
  for (let i = 0; i < vec.length; i++) {
    normSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(normSq);
  if (norm <= 1e-12) return vec.map(() => 0);
  return vec.map((v) => v / norm);
}

export function computeCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const sum = new Array<number>(dim).fill(0);
  let valid = 0;
  for (const v of vectors) {
    if (v.length !== dim) continue;
    valid++;
    for (let i = 0; i < dim; i++) {
      sum[i] += v[i];
    }
  }
  if (valid === 0) return [];
  const avg = sum.map((x) => x / valid);
  return normalizeL2(avg);
}

export function euclideanDistance(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 1.0;
  let sumSq = 0;
  for (let i = 0; i < len; i++) {
    const d = a[i] - b[i];
    sumSq += d * d;
  }
  return Math.sqrt(sumSq);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 1e-12 ? Math.max(-1, Math.min(1, dot / denom)) : 0;
}

/**
 * Computes a deterministic 2D PCA projection of a matrix of high-dimensional vectors
 * using Gram matrix (N x N) power iteration + deflation — works fast even when dim = 3072.
 */
export function projectTo2DPCA(vectors: number[][]): { x: number; y: number }[] {
  const n = vectors.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: 0, y: 0 }];

  const dim = vectors[0].length;
  if (dim === 0) return vectors.map(() => ({ x: 0, y: 0 }));

  // Center rows
  const mean = new Float64Array(dim);
  for (let r = 0; r < n; r++) {
    const v = vectors[r];
    for (let c = 0; c < dim; c++) {
      mean[c] += (v[c] ?? 0) / n;
    }
  }

  const centered: Float64Array[] = vectors.map((v) => {
    const row = new Float64Array(dim);
    for (let c = 0; c < dim; c++) {
      row[c] = (v[c] ?? 0) - mean[c];
    }
    return row;
  });

  // Gram matrix G = X * X^T (n x n)
  const gram: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let s = 0;
      const ri = centered[i];
      const rj = centered[j];
      for (let c = 0; c < dim; c++) {
        s += ri[c] * rj[c];
      }
      gram[i][j] = s;
      gram[j][i] = s;
    }
  }

  const powerEigen = (mat: number[][]): { vec: number[]; val: number } => {
    const v = Array.from({ length: n }, (_, i) => ((i % 2 === 0 ? 1 : -0.7) + (i + 1) * 0.13));
    const norm0 = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0)) || 1;
    for (let i = 0; i < n; i++) v[i] /= norm0;

    let lambda = 0;
    for (let iter = 0; iter < 50; iter++) {
      const next = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let j = 0; j < n; j++) s += mat[i][j] * v[j];
        next[i] = s;
      }
      lambda = Math.sqrt(next.reduce((acc, x) => acc + x * x, 0));
      if (lambda < 1e-12) break;
      for (let i = 0; i < n; i++) v[i] = next[i] / lambda;
    }
    return { vec: v, val: lambda };
  };

  const e1 = powerEigen(gram);
  // Deflate Gram matrix
  const gram2 = gram.map((row, i) =>
    row.map((val, j) => val - e1.val * e1.vec[i] * e1.vec[j])
  );
  const e2 = powerEigen(gram2);

  const scale1 = Math.sqrt(Math.max(0, e1.val));
  const scale2 = Math.sqrt(Math.max(0, e2.val));

  return Array.from({ length: n }, (_, i) => ({
    x: e1.vec[i] * scale1,
    y: e2.vec[i] * scale2,
  }));
}
