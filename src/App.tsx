import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BuyerItem,
  ComparisonBaseline,
  EmbeddingModelId,
  ProximityResult,
  RankSortBy,
  TargetCompany,
} from './types/proximity';
import { DEFAULT_BUYER_ITEMS } from './data/defaultBuyer';
import { DEFAULT_TARGET_COMPANIES } from './data/defaultTargets';
import {
  computeTfidfVectorsMap,
  evaluateTargetProximity,
} from './utils/proximityMath';
import { computeBrowserEmbeddings } from './utils/browserEmbeddings';
import { RankingView } from './components/RankingView';
import { Download, Upload } from 'lucide-react';

const VectorsView = lazy(() =>
  import('./components/VectorsView').then((m) => ({ default: m.VectorsView }))
);
const JsonManagerView = lazy(() =>
  import('./components/JsonManagerView').then((m) => ({ default: m.JsonManagerView }))
);

type ActiveTab = 'ranking' | 'vectors' | 'json';

const KEY_TARGETS = 'tech_proximity_targets_gh_v1';
const KEY_BUYER = 'tech_proximity_buyer_gh_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('ranking');

  const [buyerItems, setBuyerItems] = useState<BuyerItem[]>(() => {
    try {
      const saved = localStorage.getItem(KEY_BUYER);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback to default buyer items
    }
    return DEFAULT_BUYER_ITEMS;
  });

  const [targets, setTargets] = useState<TargetCompany[]>(() => {
    try {
      const saved = localStorage.getItem(KEY_TARGETS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback to default targets
    }
    return DEFAULT_TARGET_COMPANIES;
  });

  const [selectedId, setSelectedId] = useState<string>(
    () => targets[0]?.id ?? DEFAULT_TARGET_COMPANIES[0].id
  );
  const [modelId, setModelId] = useState<EmbeddingModelId>('tfidf');
  const [baseline, setBaseline] = useState<ComparisonBaseline>('nearest_direction');
  const [sigmaSq, setSigmaSq] = useState<number>(0.65);
  const [sortBy, setSortBy] = useState<RankSortBy>('cosine');

  // Computed vectors map for neural models in browser
  const [neuralVectorsByModel, setNeuralVectorsByModel] = useState<
    Record<string, Map<string, number[]>>
  >({});
  const [modelLoading, setModelLoading] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelStatusNote, setModelStatusNote] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(KEY_BUYER, JSON.stringify(buyerItems));
  }, [buyerItems]);

  useEffect(() => {
    localStorage.setItem(KEY_TARGETS, JSON.stringify(targets));
  }, [targets]);

  const tfidfVectorsMap = useMemo(
    () => computeTfidfVectorsMap(buyerItems, targets),
    [buyerItems, targets]
  );

  const runBrowserNeuralModel = useCallback(
    async (targetModel: EmbeddingModelId) => {
      if (targetModel === 'tfidf') return;
      const items = [
        ...buyerItems.map((b) => ({ id: b.id, text: b.text_for_vectorization })),
        ...targets.map((t) => ({ id: t.id, text: t.text_for_vectorization })),
      ].filter((x) => Boolean(x.text?.trim()));

      if (items.length === 0) return;

      setModelLoading(true);
      setModelProgress(2);
      setModelError(null);
      setModelStatusNote('Подготовка модели векторизации в браузере...');

      try {
        const vecMap = await computeBrowserEmbeddings(
          targetModel,
          items,
          (pct, note) => {
            setModelProgress(pct);
            setModelStatusNote(note);
          }
        );
        setNeuralVectorsByModel((prev) => ({ ...prev, [targetModel]: vecMap }));
        setModelStatusNote(null);
      } catch (err: unknown) {
        setModelError(
          err instanceof Error ? err.message : 'Не удалось загрузить или выполнить модель в браузере'
        );
      } finally {
        setModelLoading(false);
      }
    },
    [buyerItems, targets]
  );

  const handleSelectModel = (nextModel: EmbeddingModelId) => {
    setModelId(nextModel);
    setModelError(null);
    if (nextModel !== 'tfidf') {
      const existing = neuralVectorsByModel[nextModel];
      const allPresent =
        existing &&
        buyerItems.every((b) => existing.has(b.id)) &&
        targets.every((t) => existing.has(t.id));
      if (!allPresent) {
        runBrowserNeuralModel(nextModel);
      }
    }
  };

  useEffect(() => {
    if (modelId === 'tfidf' || modelLoading) return;
    const existing = neuralVectorsByModel[modelId];
    const allPresent =
      existing &&
      buyerItems.every((b) => existing.has(b.id)) &&
      targets.every((t) => existing.has(t.id));
    if (!allPresent) {
      runBrowserNeuralModel(modelId);
    }
  }, [modelId, buyerItems, targets, neuralVectorsByModel, modelLoading, runBrowserNeuralModel]);

  const activeVectorsMap = useMemo(() => {
    if (modelId !== 'tfidf' && neuralVectorsByModel[modelId]) {
      return neuralVectorsByModel[modelId];
    }
    return tfidfVectorsMap;
  }, [modelId, neuralVectorsByModel, tfidfVectorsMap]);

  const rankedResults = useMemo<ProximityResult[]>(() => {
    const list = targets.map((company) =>
      evaluateTargetProximity(company, buyerItems, activeVectorsMap, sigmaSq, baseline)
    );
    return list.sort((a, b) => {
      if (sortBy === 'cosine') return b.cosine_similarity - a.cosine_similarity;
      if (sortBy === 'distance') return a.euclidean_distance - b.euclidean_distance;
      return b.novelty - a.novelty;
    });
  }, [targets, buyerItems, activeVectorsMap, sigmaSq, baseline, sortBy]);

  const handleAppendTargets = (added: TargetCompany[]) => {
    setTargets((prev) => [...added, ...prev]);
    if (added[0]) setSelectedId(added[0].id);
  };

  const handleDeleteTarget = (id: string) => {
    setTargets((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (selectedId === id && next[0]) setSelectedId(next[0].id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('ranking')}
            className="text-lg font-display font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Близость технологий
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {(
              [
                { id: 'ranking', label: 'Расчёт и рейтинг' },
                { id: 'vectors', label: 'Векторы (Покупатель и Цели)' },
                { id: 'json', label: 'JSON банка и компаний' },
              ] as { id: ActiveTab; label: string }[]
            ).map((nav) => {
              const active = activeTab === nav.id;
              return (
                <button
                  key={nav.id}
                  type="button"
                  onClick={() => setActiveTab(nav.id)}
                  className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'border-blue-700 text-blue-700'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {nav.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="./rukovodstvo.md"
              download="rukovodstvo.md"
              title="Скачать руководство"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Руководство</span>
            </a>
            <button
              type="button"
              onClick={() => setActiveTab('json')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Загрузить JSON
            </button>
          </div>
        </div>

        <div className="md:hidden border-t border-slate-100 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {(
            [
              { id: 'ranking', label: 'Рейтинг' },
              { id: 'vectors', label: 'Векторы' },
              { id: 'json', label: 'JSON' },
            ] as { id: ActiveTab; label: string }[]
          ).map((nav) => (
            <button
              key={nav.id}
              type="button"
              onClick={() => setActiveTab(nav.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === nav.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {nav.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-[1320px] w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'ranking' && (
          <RankingView
            modelId={modelId}
            onSelectModel={handleSelectModel}
            modelLoading={modelLoading}
            modelProgress={modelProgress}
            modelStatusNote={modelStatusNote}
            modelError={modelError}
            onRecomputeModel={() => runBrowserNeuralModel(modelId)}
            baseline={baseline}
            onChangeBaseline={setBaseline}
            sigmaSq={sigmaSq}
            onChangeSigmaSq={setSigmaSq}
            sortBy={sortBy}
            onChangeSortBy={setSortBy}
            rankedResults={rankedResults}
            selectedId={selectedId}
            onSelectCompany={setSelectedId}
          />
        )}

        <Suspense
          fallback={
            <div className="p-6 text-xs text-slate-500 bg-white border border-slate-200 rounded-xl">
              Загрузка вкладки...
            </div>
          }
        >
          {activeTab === 'vectors' && (
            <VectorsView
              modelId={modelId}
              buyerItems={buyerItems}
              vectorsMap={activeVectorsMap}
              rankedResults={rankedResults}
              selectedId={selectedId}
            />
          )}

          {activeTab === 'json' && (
            <JsonManagerView
              buyerItems={buyerItems}
              onUpdateBuyerItems={setBuyerItems}
              onResetBuyerItems={() => setBuyerItems(DEFAULT_BUYER_ITEMS)}
              targets={targets}
              onAppendTargets={handleAppendTargets}
              onDeleteTarget={handleDeleteTarget}
              onResetTargets={() => {
                setTargets(DEFAULT_TARGET_COMPANIES);
                setSelectedId(DEFAULT_TARGET_COMPANIES[0].id);
              }}
            />
          )}
        </Suspense>
      </main>
    </div>
  );
}
