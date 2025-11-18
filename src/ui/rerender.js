import { empty } from '../utils/dom.js';
import { updateHeaderCounts } from './header.js';

/**
 * Перерисовка списка задач. Принимает функцию рендера элемента.
 */
export function rerenderList(listEl, tasks, renderItem) {
  empty(listEl);
  tasks.forEach((t) => {
    listEl.appendChild(renderItem(t));
  });
  updateHeaderCounts(tasks);
}

