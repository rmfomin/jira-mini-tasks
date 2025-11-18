# Jira Mini Tasks

Adds personal To-Do list linked to JIRA issues.

Build and usage

- Install deps: `npm install`
- Build once: `npm run build` → outputs `dist/jira-mini-tasks.user.js`
- Watch mode: `npm run dev`

Development layout (ES modules)

- `src/constants.js` — селекторы/ключи/интервалы
- `src/utils/*` — DOM-утилиты, опрос контейнера
- `src/api/jira.js` — обертка над Jira REST API
- `src/storage/index.js` — `loadTasks`/`saveTasks`
- `src/dnd/index.js` — DnD состояние и сохранение порядка
- `src/ui/*` — рендер списка/элемента, заголовок, перерисовка
- `src/bootstrap.js` — инициализация виджета, точка входа `main()`
- `scripts/header.txt` — userscript-баннер для Tampermonkey
- `scripts/build.mjs` — сборка через esbuild (IIFE+баннер)

Tampermonkey

- Устанавливайте итоговый файл из `dist/jira-mini-tasks.user.js`
- Метаданные (`@grant`, `@match`) берутся из `scripts/header.txt`
