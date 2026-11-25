import React from 'react';
import {
  ComparisonBaseline,
  EmbeddingModelId,
  ProximityResult,
  RankSortBy,
} from '../types/proximity';
import { MODEL_OPTIONS } from '../utils/proximityMath';
import { RefreshCw } from 'lucide-react';

interface RankingViewProps {
  modelId: EmbeddingModelId;
  onSelectModel: (id: EmbeddingModelId) => void;
  modelLoading: boolean;
  modelProgress: number;
  modelStatusNote: string | null;
  modelError: string | null;
  onRecomputeModel: () => void;
  baseline: ComparisonBaseline;
  onChangeBaseline: (b: ComparisonBaseline) => void;
  sigmaSq: number;
  onChangeSigmaSq: (val: number) => void;
  sortBy: RankSortBy;
  onChangeSortBy: (s: RankSortBy) => void;
  rankedResults: ProximityResult[];
  selectedId: string;
  onSelectCompany: (id: string) => void;
}

export const RankingView: React.FC<RankingViewProps> = ({
  modelId,
  onSelectModel,
  modelLoading,
  modelProgress,
  modelStatusNote,
  modelError,
  onRecomputeModel,
  baseline,
  onChangeBaseline,
  sigmaSq,
  onChangeSigmaSq,
  sortBy,
  onChangeSortBy,
  rankedResults,
  selectedId,
  onSelectCompany,
}) => {
  const selected =
    rankedResults.find((r) => r.company.id === selectedId) ?? rankedResults[0];

  const activeModelMeta = MODEL_OPTIONS.find((m) => m.id === modelId);

  return (
    <div className="space-y-6">
      {/* Model Selector & Parameters Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Выбор модели векторизации (в браузере) и параметры сравнения
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {activeModelMeta?.repoOrEngine} — {activeModelMeta?.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap p-1 bg-slate-100 rounded-lg gap-1">
              {MODEL_OPTIONS.map((opt) => {
                const active = opt.id === modelId;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={modelLoading}
                    onClick={() => onSelectModel(opt.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {modelId !== 'tfidf' && (
              <button
                type="button"
                disabled={modelLoading}
                onClick={onRecomputeModel}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${modelLoading ? 'animate-spin' : ''}`} />
                Пересчитать
              </button>
            )}
          </div>
        </div>

        {/* Download & Inference Progress */}
        {modelLoading && (
          <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 space-y-2">
            <div className="flex items-center justify-between text-xs text-blue-900">
              <span>
                {modelStatusNote ||
                  'Загрузка весов нейросети в кэш браузера... При повторном открытии загрузка не потребуется.'}
              </span>
              <span className="font-mono font-semibold">{modelProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-700 transition-all duration-200"
                style={{ width: `${Math.max(4, modelProgress)}%` }}
              />
            </div>
          </div>
        )}

        {modelError && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-3">
            <span>Ошибка загрузки модели: {modelError}</span>
            <button
              type="button"
              onClick={() => onSelectModel('tfidf')}
              className="px-2.5 py-1 bg-white border border-rose-300 rounded text-xs font-medium text-rose-800 cursor-pointer shrink-0"
            >
              Переключить на TF-IDF
            </button>
          </div>
        )}

        {/* Comparison Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-700">С кем сравнивать вектор цели V_B</div>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => onChangeBaseline('nearest_direction')}
                className={`px-2 py-1.5 text-xs font-medium rounded-md cursor-pointer truncate ${
                  baseline === 'nearest_direction'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Ближайшее направление
              </button>
              <button
                type="button"
                onClick={() => onChangeBaseline('global_centroid')}
                className={`px-2 py-1.5 text-xs font-medium rounded-md cursor-pointer truncate ${
                  baseline === 'global_centroid'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Общий центроид банка
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-700">Запас прочности σ² (для N_vec)</span>
              <span className="font-mono font-semibold text-blue-700">{sigmaSq.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="2.00"
              step="0.05"
              value={sigmaSq}
              onChange={(e) => onChangeSigmaSq(parseFloat(e.target.value))}
              className="w-full accent-blue-700 cursor-pointer mt-2"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-700">Ранжировать компании по</div>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => onChangeSortBy('cosine')}
                className={`px-2 py-1.5 text-xs font-medium rounded-md cursor-pointer truncate ${
                  sortBy === 'cosine' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Сходство cos
              </button>
              <button
                type="button"
                onClick={() => onChangeSortBy('distance')}
                className={`px-2 py-1.5 text-xs font-medium rounded-md cursor-pointer truncate ${
                  sortBy === 'distance' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Дистанция d
              </button>
              <button
                type="button"
                onClick={() => onChangeSortBy('novelty')}
                className={`px-2 py-1.5 text-xs font-medium rounded-md cursor-pointer truncate ${
                  sortBy === 'novelty' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Новизна N_vec
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Split: Ranked Companies Table + Detailed Proximity Calculation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Ранжирование компаний ({rankedResults.length})
            </h2>
            <span className="text-xs text-slate-500">Нажмите строку для разбора расчёта</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="py-2 pr-2 font-medium">#</th>
                  <th className="py-2 px-2 font-medium">Компания</th>
                  <th className="py-2 px-2 font-medium text-right">cos(θ)</th>
                  <th className="py-2 px-2 font-medium text-right">||V_A−V_B||₂</th>
                  <th className="py-2 pl-2 font-medium text-right">N_vec</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rankedResults.map((res, idx) => {
                  const isSel = selected?.company.id === res.company.id;
                  return (
                    <tr
                      key={res.company.id}
                      onClick={() => onSelectCompany(res.company.id)}
                      className={`cursor-pointer transition-colors ${
                        isSel ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 pr-2 font-mono text-xs text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-2">
                        <div className="font-medium text-slate-900">{res.company.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {res.closest_direction.direction} · ИНН {res.company.inn}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right font-mono tabular-nums text-slate-800">
                        {(res.cosine_similarity * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-2 text-right font-mono tabular-nums text-slate-700">
                        {res.euclidean_distance.toFixed(4)}
                      </td>
                      <td className="py-3 pl-2 text-right font-mono tabular-nums font-semibold text-blue-700">
                        {res.novelty.toFixed(4)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {selected && (
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <div className="text-xs text-slate-500">
                Расчёт близости для цели · {selected.comparison_label}
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">{selected.company.name}</h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {selected.company.text_for_vectorization}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500">Евклидова дистанция d</div>
                <div className="text-lg font-mono font-bold text-slate-900 tabular-nums mt-0.5">
                  {selected.euclidean_distance.toFixed(4)}
                </div>
                <div className="text-[10px] font-mono text-slate-500 mt-0.5">||V_A − V_B||₂</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500">Косинусная близость</div>
                <div className="text-lg font-mono font-bold text-teal-700 tabular-nums mt-0.5">
                  {(selected.cosine_similarity * 100).toFixed(2)}%
                </div>
                <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                  cos = {selected.cosine_similarity.toFixed(4)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500">Технологическая новизна</div>
                <div className="text-lg font-mono font-bold text-blue-700 tabular-nums mt-0.5">
                  {selected.novelty.toFixed(4)}
                </div>
                <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                  d·exp(−d²/(2·{sigmaSq.toFixed(2)}))
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-700 font-medium">
                <span>Срез координат векторов (dim = {selected.target_vector.length})</span>
                <span className="font-mono text-[11px] text-slate-500">L2-норма = 1.000</span>
              </div>
              <div className="font-mono text-[11px] text-slate-700 break-all">
                <span className="font-semibold text-slate-900">V_A (банк): </span>[
                {selected.comparison_vector
                  .slice(0, 6)
                  .map((v) => v.toFixed(4))
                  .join(', ')}
                , ...]
              </div>
              <div className="font-mono text-[11px] text-blue-800 break-all">
                <span className="font-semibold">V_B (цель): </span>[
                {selected.target_vector
                  .slice(0, 6)
                  .map((v) => v.toFixed(4))
                  .join(', ')}
                , ...]
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-900">
                Близость к направлениям покупателя (банка)
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <th className="py-2 px-2.5 font-medium">Направление банка</th>
                      <th className="py-2 px-2 font-medium text-right">cos(θ)</th>
                      <th className="py-2 px-2 font-medium text-right">d</th>
                      <th className="py-2 px-2.5 font-medium text-right">N_vec</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selected.direction_matches.map((dm, i) => (
                      <tr key={dm.direction} className={i === 0 ? 'bg-blue-50/50' : ''}>
                        <td className="py-2 px-2.5 font-medium text-slate-900">
                          {dm.direction}{' '}
                          <span className="text-[11px] text-slate-400">({dm.item_count})</span>
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-700">
                          {(dm.cosine_similarity * 100).toFixed(1)}%
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-700">
                          {dm.euclidean_distance.toFixed(4)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums font-semibold text-blue-700">
                          {dm.novelty.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-900">
                Ближайшие системы и стартапы в JSON покупателя
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {selected.closest_buyer_items.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{item.name}</div>
                      <div className="text-[11px] text-slate-500">{item.direction}</div>
                    </div>
                    <div className="font-mono tabular-nums text-right shrink-0">
                      <span className="text-teal-700 font-medium">
                        {(item.cosine_similarity * 100).toFixed(1)}%
                      </span>
                      <span className="text-slate-400 mx-1">·</span>
                      <span className="text-slate-600">d={item.euclidean_distance.toFixed(3)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
