import { STORAGE_KEY } from '../constants.js';

/** Загрузка списка задач */
export function loadTasks() {
  try {
    const raw = GM_getValue(STORAGE_KEY, '[]');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch (e) {
    return [];
  }
}

/** Сохранение списка задач */
export function saveTasks(tasks) {
  try {
    GM_setValue(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {}
}

