import { CONTENT_SELECTOR, HEADER_SELECTOR, WRAPPER_ID } from './constants.js';
import { empty, el } from './utils/dom.js';
import { pollForGadget } from './utils/poll.js';
import { renderUI } from './ui/index.js';
import { loadTasks } from './storage/index.js';
import { updateHeaderCounts } from './ui/header.js';

let globalMenuCloserAttached = false;

/** Глобальный обработчик закрытия меню */
export function setupGlobalMenuCloser() {
  if (globalMenuCloserAttached) return;
  document.addEventListener('click', (ev) => {
    const target = ev.target;
    if (!(target instanceof Node)) return;
    const wraps = document.querySelectorAll('.tm-menu-wrap');
    wraps.forEach((wrap) => {
      if (!wrap.contains(target)) {
        const menu = wrap.querySelector('.tm-item-menu');
        if (menu) menu.style.display = 'none';
      }
    });
  });
  globalMenuCloserAttached = true;
}

/** Инициализация каркаса и UI */
export function bootstrap(gadgetEl) {
  if (!gadgetEl) return;

  const headerEl = gadgetEl.querySelector(HEADER_SELECTOR);
  if (headerEl) headerEl.textContent = 'Jira Mini Tasks';

  const contentEl = gadgetEl.querySelector(CONTENT_SELECTOR);
  if (!contentEl) return;

  const alreadyMounted = contentEl.querySelector(`#${WRAPPER_ID}`);
  if (alreadyMounted) return;

  empty(contentEl);

  const wrapper = el('div', { id: WRAPPER_ID });
  wrapper.style.padding = '12px 12px';
  wrapper.style.border = '1px solid #e5e5e5';
  wrapper.style.borderRadius = '8px';
  wrapper.style.background = '#fff';

  contentEl.appendChild(wrapper);

  const tasks = loadTasks();
  renderUI(wrapper, tasks);
  updateHeaderCounts(tasks);
  setupGlobalMenuCloser();
}

/** Точка входа */
export function main() {
  pollForGadget(bootstrap);
}

