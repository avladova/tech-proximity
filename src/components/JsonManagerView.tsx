import React, { useEffect, useState } from 'react';
import { BuyerItem, TargetCompany } from '../types/proximity';
import { parseUploadedBuyerJson, parseUploadedTargetsJson } from '../data/defaultTargets';
import { Upload, Download, Plus, Trash2, RotateCcw } from 'lucide-react';

interface JsonManagerViewProps {
  buyerItems: BuyerItem[];
  onUpdateBuyerItems: (next: BuyerItem[]) => void;
  onResetBuyerItems: () => void;
  targets: TargetCompany[];
  onAppendTargets: (added: TargetCompany[]) => void;
  onDeleteTarget: (id: string) => void;
  onResetTargets: () => void;
}

export const JsonManagerView: React.FC<JsonManagerViewProps> = ({
  buyerItems,
  onUpdateBuyerItems,
  onResetBuyerItems,
  targets,
  onAppendTargets,
  onDeleteTarget,
  onResetTargets,
}) => {
  const [targetNotice, setTargetNotice] = useState<string | null>(null);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [pasteTargetJson, setPasteTargetJson] = useState('');

  const [newName, setNewName] = useState('');
  const [newInn, setNewInn] = useState('');
  const [newIndustry, setNewIndustry] = useState('');
  const [newText, setNewText] = useState('');

  const [bankDraft, setBankDraft] = useState('');
  const [bankMode, setBankMode] = useState<'append' | 'replace'>('append');
  const [bankNotice, setBankNotice] = useState<string | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);

  useEffect(() => {
    setBankDraft(JSON.stringify(buyerItems, null, 2));
  }, [buyerItems]);

  const handleUploadTargetsFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items = parseUploadedTargetsJson(parsed);
      if (items.length === 0) {
        throw new Error('Не найдено ни одной компании с текстом для векторизации.');
      }
      onAppendTargets(items);
      setTargetNotice(`Дозагружено компаний: ${items.length}`);
      setTargetError(null);
    } catch (err: unknown) {
      setTargetError(err instanceof Error ? err.message : 'Ошибка чтения JSON файла');
    }
    e.target.value = '';
  };

  const handlePasteTargets = () => {
    if (!pasteTargetJson.trim()) return;
    try {
      const parsed = JSON.parse(pasteTargetJson);
      const items = parseUploadedTargetsJson(parsed);
      if (items.length === 0) {
        throw new Error('Не найдены поля text_for_vectorization / текст_для_векторизации.');
      }
      onAppendTargets(items);
      setPasteTargetJson('');
      setTargetNotice(`Дозагружено из вставленного JSON: ${items.length}`);
      setTargetError(null);
    } catch (err: unknown) {
      setTargetError(err instanceof Error ? err.message : 'Некорректный JSON');
    }
  };

  const handleAddManualTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newText.trim()) return;
    onAppendTargets([
      {
        id: `manual-${Date.now()}`,
        name: newName.trim(),
        inn: newInn.trim() || '—',
        industry: newIndustry.trim() || 'Технологии',
        tech_stack: [],
        text_for_vectorization: newText.trim(),
      },
    ]);
    setNewName('');
    setNewInn('');
    setNewIndustry('');
    setNewText('');
    setTargetNotice(`Добавлена компания «${newName.trim()}»`);
    setTargetError(null);
  };

  const handleDownloadTargets = () => {
    const blob = new Blob([JSON.stringify(targets, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'target_companies.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadBankFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items = parseUploadedBuyerJson(parsed);
      if (items.length === 0) {
        throw new Error('В JSON банка не найдено записей с текстом для векторизации.');
      }
      const next = bankMode === 'replace' ? items : [...buyerItems, ...items];
      onUpdateBuyerItems(next);
      setBankNotice(
        bankMode === 'replace'
          ? `JSON банка заменён (${items.length} позиций)`
          : `В JSON банка дозагружено: ${items.length} (всего ${next.length})`
      );
      setBankError(null);
    } catch (err: unknown) {
      setBankError(err instanceof Error ? err.message : 'Ошибка чтения JSON банка');
    }
    e.target.value = '';
  };

  const handleApplyBankEditor = () => {
    try {
      const parsed = JSON.parse(bankDraft);
      const items = parseUploadedBuyerJson(parsed);
      if (items.length === 0) {
        throw new Error('Должна быть хотя бы 1 позиция с текстом для векторизации.');
      }
      onUpdateBuyerItems(items);
      setBankNotice(`JSON банка обновлён (${items.length} позиций)`);
      setBankError(null);
    } catch (err: unknown) {
      setBankError(err instanceof Error ? err.message : 'Некорректный JSON');
    }
  };

  const handleDownloadBank = () => {
    const blob = new Blob([JSON.stringify(buyerItems, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bank_buyer.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Target Companies JSON Upload & Add */}
      <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h1 className="text-base font-bold text-slate-900">
              Компании к покупке ({targets.length})
            </h1>
            <p className="text-xs text-slate-500">
              Дозагрузка JSON-файлов (массив или 1 объект) и ручное добавление целей
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer whitespace-nowrap">
              <Upload className="w-3.5 h-3.5" />
              Дозагрузить JSON
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleUploadTargetsFile}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={handleDownloadTargets}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Скачать
            </button>
          </div>
        </div>

        {/* Manual quick form */}
        <form
          onSubmit={handleAddManualTarget}
          className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5"
        >
          <div className="text-xs font-semibold text-slate-800">Добавить компанию вручную</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название компании *"
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            />
            <input
              type="text"
              value={newInn}
              onChange={(e) => setNewInn(e.target.value)}
              placeholder="ИНН (необязательно)"
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
            />
            <input
              type="text"
              value={newIndustry}
              onChange={(e) => setNewIndustry(e.target.value)}
              placeholder="Отрасль"
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            />
          </div>
          <textarea
            rows={2}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Описание технологий, решаемой проблемы и метода для векторизации *"
            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
          />
          <button
            type="submit"
            disabled={!newName.trim() || !newText.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 rounded-lg cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Добавить компанию
          </button>
        </form>

        {/* Paste JSON directly */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-700">
            Или вставьте JSON новой компании / массива компаний
          </div>
          <textarea
            rows={3}
            value={pasteTargetJson}
            onChange={(e) => setPasteTargetJson(e.target.value)}
            placeholder='[{"name": "Компания Х", "inn": "77...", "text_for_vectorization": "..."}]'
            className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 font-mono text-xs"
          />
          <button
            type="button"
            disabled={!pasteTargetJson.trim()}
            onClick={handlePasteTargets}
            className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg cursor-pointer"
          >
            Дозагрузить из текста JSON
          </button>
        </div>

        {targetNotice && (
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
            {targetNotice}
          </div>
        )}
        {targetError && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {targetError}
          </div>
        )}

        {/* Current Targets List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Текущий список целей</span>
            <button
              type="button"
              onClick={onResetTargets}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Сбросить к исходным
            </button>
          </div>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-72 overflow-y-auto">
            {targets.map((t) => (
              <div key={t.id} className="px-3 py-2.5 flex items-start justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">
                    {t.name} <span className="font-mono text-slate-400">· ИНН {t.inn}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                    {t.text_for_vectorization}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteTarget(t.id)}
                  className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                  title="Удалить компанию"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Right: Buyer (Bank) JSON Update */}
      <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              JSON Покупателя / Банка ({buyerItems.length} позиций)
            </h2>
            <p className="text-xs text-slate-500">
              Обновление профиля банка: дозагрузка новых направлений или замена JSON
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadBank}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Скачать
            </button>
            <button
              type="button"
              onClick={onResetBuyerItems}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              Исходный
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
          <div className="flex p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setBankMode('append')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                bankMode === 'append' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Дозагрузить к банку
            </button>
            <button
              type="button"
              onClick={() => setBankMode('replace')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                bankMode === 'replace' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Заменить JSON банка
            </button>
          </div>

          <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap">
            <Upload className="w-3.5 h-3.5" />
            Выбрать JSON банка
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleUploadBankFile}
              className="hidden"
            />
          </label>
        </div>

        {bankNotice && (
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
            {bankNotice}
          </div>
        )}
        {bankError && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {bankError}
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-700">
            Редактор JSON покупателя (можно редактировать напрямую)
          </label>
          <textarea
            value={bankDraft}
            onChange={(e) => setBankDraft(e.target.value)}
            rows={17}
            spellCheck={false}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleApplyBankEditor}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
            >
              Обновить JSON банка
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
