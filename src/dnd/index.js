import { loadTasks, saveTasks } from '../storage/index.js';

let draggingId = null;

export function setDraggingId(id) {
  draggingId = id;
}

export function getDraggingId() {
  return draggingId;
}

/**
 * Сохраняет порядок задач по текущему DOM и возвращает новый массив задач
 */
export function persistOrderFromDom(listEl) {
  const ids = Array.from(listEl.children)
    .map((n) => n.dataset && n.dataset.id)
    .filter(Boolean);
  const tasks = loadTasks();
  const map = new Map(tasks.map((t) => [String(t.id), t]));
  const next = ids
    .map((id) => map.get(String(id)))
    .filter(Boolean);
  if (next.length === tasks.length) {
    saveTasks(next);
    return next;
  }
  return tasks;
}

