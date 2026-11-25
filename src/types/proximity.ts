export type EmbeddingModelId = 'tfidf' | 'e5-small' | 'minilm-l12' | 'bge-m3';

export type ComparisonBaseline = 'nearest_direction' | 'global_centroid';
export type RankSortBy = 'novelty' | 'cosine' | 'distance';

export interface ModelOptionMeta {
  id: EmbeddingModelId;
  label: string;
  repoOrEngine: string;
  description: string;
}

export interface BuyerItem {
  id: string;
  name: string;
  direction: string;
  source: 'reestr_po' | 'accelerator' | 'custom';
  inn: string;
  tech_stack: string[];
  text_for_vectorization: string;
}

export interface TargetCompany {
  id: string;
  name: string;
  inn: string;
  industry: string;
  tech_stack: string[];
  text_for_vectorization: string;
}

export interface DirectionMatch {
  direction: string;
  item_count: number;
  centroid: number[];
  euclidean_distance: number;
  cosine_similarity: number;
  novelty: number;
}

export interface BuyerItemMatch {
  id: string;
  name: string;
  direction: string;
  source: BuyerItem['source'];
  euclidean_distance: number;
  cosine_similarity: number;
}

export interface CompanyProximityResult {
  company: TargetCompany;
  target_vector: number[];
  comparison_vector: number[];
  comparison_label: string;
  euclidean_distance: number;
  cosine_similarity: number;
  novelty: number;
  closest_direction: DirectionMatch;
  direction_matches: DirectionMatch[];
  closest_buyer_items: BuyerItemMatch[];
}

export type ProximityResult = CompanyProximityResult;

export interface PcaPoint {
  id: string;
  label: string;
  kind: 'buyer_direction' | 'target';
  x: number;
  y: number;
  isSelected?: boolean;
}
