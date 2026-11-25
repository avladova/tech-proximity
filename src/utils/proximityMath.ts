import {
  BuyerItem,
  BuyerItemMatch,
  CompanyProximityResult,
  ComparisonBaseline,
  DirectionMatch,
  ModelOptionMeta,
  TargetCompany,
} from '../types/proximity';
import {
  buildTfidfCorpus,
  computeCentroid,
  cosineSimilarity,
  euclideanDistance,
  vectorizeTfidf,
} from './tfidf';

export const MODEL_OPTIONS: ModelOptionMeta[] = [
  {
    id: 'tfidf',
    label: 'TF-IDF (мгновенно)',
    repoOrEngine: 'Локальные N-граммы 3..5 + слова',
    description: 'Работает мгновенно в браузере без скачивания весов.',
  },
  {
    id: 'e5-small',
    label: 'Multilingual E5-Small',
    repoOrEngine: 'Xenova/multilingual-e5-small (q8, ~113 МБ, 384-dim)',
    description: 'Быстрый нейросетевой энкодер прямо в браузере (RU/EN).',
  },
  {
    id: 'minilm-l12',
    label: 'MiniLM-L12 Multilingual',
    repoOrEngine: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2 (q8, ~113 МБ, 384-dim)',
    description: 'Мультиязычная модель семантического сходства в браузере.',
  },
  {
    id: 'bge-m3',
    label: 'BGE-M3 (ПК, 1024-dim)',
    repoOrEngine: 'onnx-community/bge-m3-ONNX (q8, ~542 МБ, 1024-dim)',
    description: 'Мощная модель BAAI для ПК-браузеров (первая загрузка дольше).',
  },
];

export function computeNoveltyScore(distance: number, sigmaSq: number): number {
  const safeSigma = Math.max(0.02, sigmaSq);
  const d = Math.max(0, distance);
  return d * Math.exp(-(d * d) / (2 * safeSigma));
}

export function computeTfidfVectorsMap(
  buyerItems: BuyerItem[],
  targets: TargetCompany[]
): Map<string, number[]> {
  const docs = [
    ...buyerItems.map((b) => b.text_for_vectorization),
    ...targets.map((t) => t.text_for_vectorization),
  ];
  const corpus = buildTfidfCorpus(docs);
  const map = new Map<string, number[]>();

  for (const b of buyerItems) {
    map.set(b.id, vectorizeTfidf(b.text_for_vectorization, corpus));
  }
  for (const t of targets) {
    map.set(t.id, vectorizeTfidf(t.text_for_vectorization, corpus));
  }
  return map;
}

export function computeDirectionCentroids(
  buyerItems: BuyerItem[],
  vectorsMap: Map<string, number[]>
): { direction: string; count: number; centroid: number[] }[] {
  const byDir = new Map<string, number[][]>();

  for (const item of buyerItems) {
    const vec = vectorsMap.get(item.id);
    if (!vec || vec.length === 0) continue;
    const list = byDir.get(item.direction) ?? [];
    list.push(vec);
    byDir.set(item.direction, list);
  }

  const out: { direction: string; count: number; centroid: number[] }[] = [];
  for (const [direction, vecs] of byDir.entries()) {
    out.push({
      direction,
      count: vecs.length,
      centroid: computeCentroid(vecs),
    });
  }
  return out;
}

export function computeGlobalBuyerCentroid(
  buyerItems: BuyerItem[],
  vectorsMap: Map<string, number[]>
): number[] {
  const vecs: number[][] = [];
  for (const item of buyerItems) {
    const v = vectorsMap.get(item.id);
    if (v && v.length > 0) vecs.push(v);
  }
  return computeCentroid(vecs);
}

export function evaluateTargetProximity(
  company: TargetCompany,
  buyerItems: BuyerItem[],
  vectorsMap: Map<string, number[]>,
  sigmaSq: number,
  baseline: ComparisonBaseline
): CompanyProximityResult {
  const targetVec = vectorsMap.get(company.id) ?? [];
  const dirCentroids = computeDirectionCentroids(buyerItems, vectorsMap);
  const globalCentroid = computeGlobalBuyerCentroid(buyerItems, vectorsMap);

  const directionMatches: DirectionMatch[] = dirCentroids.map((dc) => {
    const dist = euclideanDistance(dc.centroid, targetVec);
    const cos = cosineSimilarity(dc.centroid, targetVec);
    return {
      direction: dc.direction,
      item_count: dc.count,
      centroid: dc.centroid,
      euclidean_distance: dist,
      cosine_similarity: cos,
      novelty: computeNoveltyScore(dist, sigmaSq),
    };
  });

  directionMatches.sort((a, b) => a.euclidean_distance - b.euclidean_distance);

  const closestDir: DirectionMatch = directionMatches[0] ?? {
    direction: 'Общий профиль',
    item_count: 0,
    centroid: globalCentroid,
    euclidean_distance: 1.0,
    cosine_similarity: 0,
    novelty: computeNoveltyScore(1.0, sigmaSq),
  };

  const itemMatches: BuyerItemMatch[] = [];
  for (const item of buyerItems) {
    const vec = vectorsMap.get(item.id);
    if (!vec || vec.length === 0) continue;
    itemMatches.push({
      id: item.id,
      name: item.name,
      direction: item.direction,
      source: item.source,
      euclidean_distance: euclideanDistance(vec, targetVec),
      cosine_similarity: cosineSimilarity(vec, targetVec),
    });
  }
  itemMatches.sort((a, b) => a.euclidean_distance - b.euclidean_distance);

  const compVec =
    baseline === 'nearest_direction' ? closestDir.centroid : globalCentroid;
  const compLabel =
    baseline === 'nearest_direction'
      ? `Направление «${closestDir.direction}»`
      : 'Общий центроид покупателя';

  const distUsed =
    compVec.length > 0 ? euclideanDistance(compVec, targetVec) : 1.0;
  const cosUsed =
    compVec.length > 0 ? cosineSimilarity(compVec, targetVec) : 0;
  const novelty = computeNoveltyScore(distUsed, sigmaSq);

  return {
    company,
    target_vector: targetVec,
    comparison_vector: compVec,
    comparison_label: compLabel,
    euclidean_distance: distUsed,
    cosine_similarity: cosUsed,
    novelty,
    closest_direction: closestDir,
    direction_matches: directionMatches,
    closest_buyer_items: itemMatches.slice(0, 6),
  };
}

export function l2Norm(vec: number[]): number {
  let s = 0;
  for (let i = 0; i < vec.length; i++) s += vec[i] * vec[i];
  return Math.sqrt(s);
}
