import { HEADER_SELECTOR } from '../constants.js';

/**
 * Обновляет заголовок виджета количеством задач
 */
export function updateHeaderCounts(tasks) {
  try {
    const headerEl = document.querySelector(HEADER_SELECTOR);
    if (!headerEl) return;
    const total = Array.isArray(tasks) ? tasks.length : 0;
    const done = Array.isArray(tasks) ? tasks.filter((t) => t && t.done).length : 0;
    const undone = Math.max(0, total - done);
    headerEl.textContent = `Jira Mini Tasks ∑ ${total} (✔ ${done}/✘ ${undone})`;
  } catch (e) {}
}

