# Проверка технологической близости (Static GitHub Pages)

Статическое веб-приложение для оценки технологической близости компаний к направлениям покупателя (банка). Работает полностью в браузере без собственного бэкенда и API-ключей.

## Модели векторизации (работают прямо в браузере)
- **TF-IDF (N-граммы 3..5 + слова)** — мгновенный локальный расчёт.
- **Multilingual E5-Small** (`Xenova/multilingual-e5-small`, q8, ~113 МБ) — быстрая мультиязычная нейросеть (RU/EN).
- **MiniLM-L12 Multilingual** (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`, q8, ~113 МБ) — семантическое сходство.
- **BGE-M3** (`onnx-community/bge-m3-ONNX`, q8, ~542 МБ) — для десктопных браузеров.

## Как опубликовать на GitHub Pages
1. Загрузите файлы проекта в ваш репозиторий на GitHub (не загружая `node_modules` и `dist`).
2. Откройте в репозитории **Settings → Pages**.
3. В пункте **Build and deployment → Source** выберите **GitHub Actions**.
4. Готовый файл `.github/workflows/deploy.yml` автоматически соберёт проект (`npm run build`) и опубликует сайт по адресу `https://<ваш-логин>.github.io/<имя-репозитория>/`.

## Локальный запуск
```bash
npm install
npm run dev
```
