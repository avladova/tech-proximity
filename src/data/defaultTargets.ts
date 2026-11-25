import { BuyerItem, TargetCompany } from '../types/proximity';

export const DEFAULT_TARGET_COMPANIES: TargetCompany[] = [
  {
    id: 'tgt-udmpay',
    name: 'UDMPAY',
    inn: '1831199420',
    industry: 'Транзакционные сервисы и встраиваемые финансы (B2B/B2C)',
    tech_stack: ['No-code конструктор', 'QR-эквайринг', 'NFC', 'REST API'],
    text_for_vectorization:
      'Транзакционные сервисы и встраиваемые финансы. Проблема: длительная и дорогостоящая техническая интеграция современных способов безналичной оплаты в сервисы бизнеса. Метод: no-code платформа для быстрой сборки и запуска платежных сценариев, прием платежей по QR-кодам и NFC без сложной разработки.',
  },
  {
    id: 'tgt-sokol',
    name: 'СУБД СОКОЛ',
    inn: '7728491035',
    industry: 'Банковская ИТ-инфраструктура и управление данными',
    tech_stack: ['Реляционная СУБД', 'SQL', 'Кластеризация', 'Linux'],
    text_for_vectorization:
      'Банковская ИТ-инфраструктура и управление данными. Проблема: зависимость критически важных банковских высоконагруженных систем от зарубежных реляционных систем управления базами данных. Метод: отечественная высокопроизводительная реляционная СУБД с поддержкой транзакционной целостности и отказоустойчивой кластеризации.',
  },
  {
    id: 'tgt-multiverse',
    name: 'MULTIVERSE (AML/115-ФЗ)',
    inn: '7714502981',
    industry: 'Регуляторные технологии RegTech и комплаенс',
    tech_stack: ['Графовый анализ', 'Anomaly Detection', 'ML', 'Python'],
    text_for_vectorization:
      'Регуляторные технологии и комплаенс. Проблема: высокая трудоемкость ручной проверки нетипичных корпоративных операций и выявления сложных схем по 115-ФЗ. Метод: интеллектуальная система автоматизации комплаенс-контроля и финансового мониторинга с использованием графового анализа связей контрагентов и моделей выявления аномалий.',
  },
  {
    id: 'tgt-findinsight',
    name: 'FindInsight',
    inn: '7703491820',
    industry: 'Искусственный интеллект и клиентская аналитика',
    tech_stack: ['Machine Learning', 'Кластеризация', 'Big Data', 'Python'],
    text_for_vectorization:
      'Искусственный интеллект и клиентская аналитика. Проблема: низкая точность классических правил сегментации клиентов и низкий отклик на стандартные маркетинговые предложения. Метод: AI-система глубокой поведенческой сегментации клиентской базы на основе транзакционной активности и машинного обучения для формирования персонализированных рекомендаций.',
  },
  {
    id: 'tgt-intellitech',
    name: 'ИНТЕЛЛИТЕХ',
    inn: '6670489124',
    industry: 'Промышленная аналитика и корпоративное финансирование',
    tech_stack: ['Industrial IoT', 'Предиктивная аналитика', 'Временные ряды'],
    text_for_vectorization:
      'Промышленная аналитика и корпоративное финансирование. Проблема: сложность оценки реального производственного состояния и операционных рисков промышленных заемщиков банка. Метод: интеллектуальная платформа сбора и предиктивного анализа индустриальных и телеметрических данных для мониторинга исполнения контрактов.',
  },
  {
    id: 'tgt-lcvd',
    name: 'Проект LCVD-печати',
    inn: '7735194022',
    industry: 'Микроэлектроника, фотоника и аппаратная безопасность',
    tech_stack: ['Лазерное осаждение LCVD', 'Фотоника', 'Микроэлектроника'],
    text_for_vectorization:
      'Микроэлектроника и фотоника. Проблема: ограничения традиционной литографии при прототипировании специализированных микроэлектронных компонентов. Метод: технология лазерно-индуцированного химического осаждения из газовой фазы для прямого формирования функциональных микроструктур без фотошаблонов.',
  },
];

/**
 * Parses arbitrary uploaded JSON (single object or array) into TargetCompany[]
 * supporting both Russian keys (название, текст_для_векторизации, отрасль...)
 * and English keys (name, text_for_vectorization, text_tech, description...).
 */
export function parseUploadedTargetsJson(raw: unknown): TargetCompany[] {
  const arr = Array.isArray(raw) ? raw : [raw];
  const result: TargetCompany[] = [];

  for (let idx = 0; idx < arr.length; idx++) {
    const obj = arr[idx] as Record<string, unknown> | null;
    if (!obj || typeof obj !== 'object') continue;

    // Also support 5-layer Master-JSON if user drops one from previous format
    const identity = obj.identity as Record<string, unknown> | undefined;
    const tech = obj.tech_novelty as Record<string, unknown> | undefined;

    const name = String(
      identity?.short_name ??
        identity?.name ??
        obj.name ??
        obj['название'] ??
        obj.title ??
        `Компания #${idx + 1}`
    );

    const inn = String(identity?.inn ?? obj.inn ?? obj['инн'] ?? obj['ИНН'] ?? '—');

    const industry = String(
      tech?.industry ?? obj.industry ?? obj['отрасль'] ?? obj.software_class ?? 'Технологии / ИТ'
    );

    const rawStack = tech?.tech_stack ?? obj.tech_stack ?? obj['тех_стек_и_платформы'];
    const tech_stack: string[] = Array.isArray(rawStack)
      ? rawStack.map(String)
      : typeof rawStack === 'string'
      ? rawStack
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const text_for_vectorization = String(
      tech?.text_for_vectorization ??
        obj.text_for_vectorization ??
        obj['текст_для_векторизации'] ??
        obj.text_for_vectorization_tech ??
        obj.text_for_vectorization_business ??
        obj.description ??
        [obj.problem ?? obj['проблема'], obj.method ?? obj['метод']].filter(Boolean).join(' ') ??
        ''
    ).trim();

    if (!text_for_vectorization) continue;

    result.push({
      id: String(obj.id ?? `upload-${Date.now()}-${idx}`),
      name,
      inn,
      industry,
      tech_stack,
      text_for_vectorization,
    });
  }

  return result;
}

/**
 * Parses arbitrary uploaded JSON (single object or array) into BuyerItem[]
 * compatible with gpb_software_registry.json, finalists.json, or custom bank format.
 */
export function parseUploadedBuyerJson(raw: unknown): BuyerItem[] {
  const arr = Array.isArray(raw) ? raw : [raw];
  const result: BuyerItem[] = [];

  for (let idx = 0; idx < arr.length; idx++) {
    const obj = arr[idx] as Record<string, unknown> | null;
    if (!obj || typeof obj !== 'object') continue;

    const name = String(obj.name ?? obj['название'] ?? `Продукт банка #${idx + 1}`);
    const direction = String(
      obj.direction ?? obj.software_class ?? obj['трек_акселератора'] ?? obj['отрасль'] ?? 'Направление банка'
    );
    const inn = String(obj.inn ?? obj['инн'] ?? '7744001497');

    const rawStack = obj.tech_stack ?? obj['тех_стек_и_платформы'];
    const tech_stack: string[] = Array.isArray(rawStack)
      ? rawStack.map(String)
      : typeof rawStack === 'string'
      ? rawStack
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const text_for_vectorization = String(
      obj.text_for_vectorization ??
        obj['текст_для_векторизации'] ??
        [obj.text_for_vectorization_business, obj.text_for_vectorization_tech]
          .filter(Boolean)
          .join(' ') ??
        ''
    ).trim();

    if (!text_for_vectorization) continue;

    result.push({
      id: String(obj.id ?? `bank-custom-${Date.now()}-${idx}`),
      name,
      direction,
      source: obj.source === 'reestr_po' || obj.source === 'accelerator' ? obj.source : 'custom',
      inn,
      tech_stack,
      text_for_vectorization,
    });
  }

  return result;
}
