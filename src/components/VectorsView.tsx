import React, { useMemo, useState } from 'react';
import {
  BuyerItem,
  EmbeddingModelId,
  PcaPoint,
  ProximityResult,
} from '../types/proximity';
import { computeDirectionCentroids, computeGlobalBuyerCentroid, l2Norm } from '../utils/proximityMath';
import { projectTo2DPCA } from '../utils/tfidf';
import { Download } from 'lucide-react';

interface VectorsViewProps {
  modelId: EmbeddingModelId;
  buyerItems: BuyerItem[];
  vectorsMap: Map<string, number[]>;
  rankedResults: ProximityResult[];
  selectedId: string;
}

export const VectorsView: React.FC<VectorsViewProps> = ({
  modelId,
  buyerItems,
  vectorsMap,
  rankedResults,
  selectedId,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const directionCentroids = useMemo(
    () => computeDirectionCentroids(buyerItems, vectorsMap),
    [buyerItems, vectorsMap]
  );

  const globalCentroid = useMemo(
    () => computeGlobalBuyerCentroid(buyerItems, vectorsMap),
    [buyerItems, vectorsMap]
  );

  const selectedRes =
    rankedResults.find((r) => r.company.id === selectedId) ?? rankedResults[0];

  const pcaPoints = useMemo<PcaPoint[]>(() => {
    const raw: number[][] = [];
    const meta: Omit<PcaPoint, 'x' | 'y'>[] = [];

    for (const dc of directionCentroids) {
      if (dc.centroid.length === 0) continue;
      raw.push(dc.centroid);
      meta.push({
        id: `dir:${dc.direction}`,
        label: dc.direction,
        kind: 'buyer_direction',
      });
    }

    for (const r of rankedResults) {
      if (r.target_vector.length === 0) continue;
      raw.push(r.target_vector);
      meta.push({
        id: r.company.id,
        label: r.company.name,
        kind: 'target',
        isSelected: r.company.id === selectedRes?.company.id,
      });
    }

    const coords = projectTo2DPCA(raw);
    let maxAbs = 0.001;
    for (const p of coords) maxAbs = Math.max(maxAbs, Math.abs(p.x), Math.abs(p.y));

    return meta.map((m, i) => ({
      ...m,
      x: coords[i].x / maxAbs,
      y: coords[i].y / maxAbs,
    }));
  }, [directionCentroids, rankedResults, selectedRes?.company.id]);

  const handleDownloadVectors = () => {
    const payload = {
      model: modelId,
      generated_at: new Date().toISOString(),
      buyer_global_centroid: globalCentroid,
      buyer_directions: directionCentroids.map((d) => ({
        direction: d.direction,
        item_count: d.count,
        vector: d.centroid,
      })),
      buyer_items: buyerItems.map((b) => ({
        id: b.id,
        name: b.name,
        direction: b.direction,
        vector: vectorsMap.get(b.id) ?? [],
      })),
      target_companies: rankedResults.map((r) => ({
        id: r.company.id,
        name: r.company.name,
        inn: r.company.inn,
        vector: r.target_vector,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vectors_${modelId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderVectorStrip = (vec: number[]) => {
    const sample = vec.slice(0, 32);
    const maxVal = Math.max(0.01, ...sample.map((x) => Math.abs(x)));
    return (
      <div className="flex items-end gap-[2px] h-6" aria-hidden="true">
        {sample.map((val, idx) => {
          const h = Math.max(2, Math.round((Math.abs(val) / maxVal) * 22));
          return (
            <div
              key={idx}
              style={{ height: `${h}px` }}
              className={`w-1.5 rounded-t-[1px] ${val >= 0 ? 'bg-blue-600' : 'bg-amber-500'}`}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header + 2D PCA Map */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Векторы покупателя (банка) и компаний к покупке
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Модель: <span className="font-mono font-medium text-slate-800">{modelId}</span> ·
              Размерность: <span className="font-mono">{globalCentroid.length}</span> · Покупатель:{' '}
              {directionCentroids.length} направлений / {buyerItems.length} объектов · Целей:{' '}
              {rankedResults.length}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadVectors}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            Скачать векторы (.json)
          </button>
        </div>

        {/* 2D PCA Scatter */}
        <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50/40">
          <svg viewBox="0 0 760 320" className="w-full h-auto block">
            <line x1="380" y1="15" x2="380" y2="305" stroke="#e2e8f0" strokeDasharray="4 4" />
            <line x1="20" y1="160" x2="740" y2="160" stroke="#e2e8f0" strokeDasharray="4 4" />

            {(() => {
              const tPt = pcaPoints.find((p) => p.isSelected);
              const dPt = selectedRes
                ? pcaPoints.find((p) => p.id === `dir:${selectedRes.closest_direction.direction}`)
                : undefined;
              if (!tPt || !dPt) return null;
              return (
                <line
                  x1={380 + tPt.x * 290}
                  y1={160 - tPt.y * 115}
                  x2={380 + dPt.x * 290}
                  y2={160 - dPt.y * 115}
                  stroke="#1d4ed8"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                />
              );
            })()}

            {pcaPoints.map((pt) => {
              const cx = 380 + pt.x * 290;
              const cy = 160 - pt.y * 115;
              if (pt.kind === 'buyer_direction') {
                return (
                  <g key={pt.id}>
                    <polygon
                      points={`${cx},${cy - 8} ${cx + 8},${cy} ${cx},${cy + 8} ${cx - 8},${cy}`}
                      fill="#0f766e"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text x={cx} y={cy + 20} textAnchor="middle" fontSize="10" fontWeight="600" fill="#0f766e">
                      {pt.label}
                    </text>
                  </g>
                );
              }
              return (
                <g key={pt.id}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={pt.isSelected ? 7 : 5}
                    fill={pt.isSelected ? '#1d4ed8' : '#64748b'}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <text
                    x={cx}
                    y={cy - 11}
                    textAnchor="middle"
                    fontSize={pt.isSelected ? '11' : '10'}
                    fontWeight={pt.isSelected ? '700' : '500'}
                    fill={pt.isSelected ? '#1e3a8a' : '#334155'}
                  >
                    {pt.label.slice(0, 22)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      {/* Two Tables: Buyer Direction Vectors & Target Company Vectors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Buyer Vectors */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Векторы покупателя (центроиды направлений банка)
          </h2>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {/* Global Centroid */}
            <div className="p-3 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    Общий центроид покупателя (V_A)
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    dim={globalCentroid.length} · ||V||={l2Norm(globalCentroid).toFixed(3)}
                  </div>
                </div>
                {renderVectorStrip(globalCentroid)}
              </div>
              <div className="font-mono text-[11px] text-slate-600 break-all">
                [{globalCentroid.slice(0, 8).map((v) => v.toFixed(4)).join(', ')}, ...]
              </div>
            </div>

            {directionCentroids.map((dc) => {
              const rowKey = `dir-${dc.direction}`;
              const isOpen = expandedId === rowKey;
              return (
                <div key={dc.direction} className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {dc.direction} ({dc.count})
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        dim={dc.centroid.length} · ||V||={l2Norm(dc.centroid).toFixed(3)}
                      </div>
                    </div>
                    {renderVectorStrip(dc.centroid)}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-[11px] text-slate-600 truncate">
                      [{dc.centroid.slice(0, 6).map((v) => v.toFixed(4)).join(', ')}, ...]
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : rowKey)}
                      className="text-[11px] text-blue-700 hover:underline shrink-0 cursor-pointer"
                    >
                      {isOpen ? 'Скрыть' : 'Весь вектор'}
                    </button>
                  </div>
                  {isOpen && (
                    <pre className="p-2 rounded bg-slate-50 border border-slate-200 font-mono text-[10px] text-slate-700 max-h-36 overflow-y-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(dc.centroid.map((n) => Number(n.toFixed(5))))}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Target Company Vectors */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Векторы компаний к покупке (V_B)
          </h2>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {rankedResults.map((res) => {
              const rowKey = `tgt-${res.company.id}`;
              const isOpen = expandedId === rowKey;
              const isSel = res.company.id === selectedRes?.company.id;
              return (
                <div
                  key={res.company.id}
                  className={`p-3 space-y-2 ${isSel ? 'bg-blue-50/50' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {res.company.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        dim={res.target_vector.length} · ||V||={l2Norm(res.target_vector).toFixed(3)}{' '}
                        · cos={(res.cosine_similarity * 100).toFixed(1)}%
                      </div>
                    </div>
                    {renderVectorStrip(res.target_vector)}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-[11px] text-slate-600 truncate">
                      [{res.target_vector.slice(0, 6).map((v) => v.toFixed(4)).join(', ')}, ...]
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : rowKey)}
                      className="text-[11px] text-blue-700 hover:underline shrink-0 cursor-pointer"
                    >
                      {isOpen ? 'Скрыть' : 'Весь вектор'}
                    </button>
                  </div>
                  {isOpen && (
                    <pre className="p-2 rounded bg-slate-50 border border-slate-200 font-mono text-[10px] text-slate-700 max-h-36 overflow-y-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(res.target_vector.map((n) => Number(n.toFixed(5))))}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
