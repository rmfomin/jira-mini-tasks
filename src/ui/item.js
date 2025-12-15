import { el, autosizeTextarea } from '../utils/dom.js';
import { loadTasks, saveTasks } from '../storage/index.js';
import { startDrag } from '../dnd/index.js';
import { rerenderList } from './rerender.js';

/**
 * Рендер одного элемента списка
 */
export function renderItem(task) {
  const row = el('div', { className: 'tm-item' });
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.flexWrap = 'wrap';
  row.style.gap = '8px';
  row.style.padding = '6px';
  row.style.border = '1px solid #ededed';
  row.style.borderRadius = '6px';
  row.dataset.id = String(task.id);

  const drag = el('span', { className: 'tm-drag', text: '⠿' });
  drag.style.cursor = 'grab';
  drag.style.userSelect = 'none';
  drag.style.color = '#9e9e9e';
  drag.style.fontSize = '20px';
  drag.style.lineHeight = '1';
  drag.style.padding = '2px 4px';

  const checkbox = el('input', { type: 'checkbox' });
  checkbox.checked = !!task.done;
  checkbox.style.transform = 'scale(1.3)';
  checkbox.style.margin = '0';

  const text = el('span', { className: 'tm-item-text', text: task.text });
  text.style.flex = '1';
  text.style.userSelect = 'none';
  text.style.wordBreak = 'break-word';
  text.style.whiteSpace = 'pre-wrap';
  text.style.cursor = 'text';
  text.title = 'Нажмите, чтобы редактировать';
  if (task.done) {
    text.style.textDecoration = 'line-through';
    text.style.opacity = '0.7';
  }

  const menuWrap = el('div', { className: 'tm-menu-wrap' });
  menuWrap.style.position = 'relative';
  const menuBtn = el('button', { type: 'button', title: 'Меню', 'aria-label': 'Меню', text: '☰' });
  menuBtn.style.padding = '4px 8px';
  menuBtn.style.border = '1px solid #bdbdbd';
  menuBtn.style.borderRadius = '6px';
  menuBtn.style.background = '#f3f3f3';
  menuBtn.style.cursor = 'pointer';
  const menu = el('div', { className: 'tm-item-menu' });
  menu.style.position = 'absolute';
  menu.style.top = 'calc(100% + 4px)';
  menu.style.right = '0';
  menu.style.background = '#fff';
  menu.style.border = '1px solid #e0e0e0';
  menu.style.borderRadius = '6px';
  menu.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
  menu.style.padding = '4px';
  menu.style.display = 'none';
  menu.style.zIndex = '1000';

  const deleteItem = el('button', { type: 'button', text: 'Удалить' });
  deleteItem.style.display = 'block';
  deleteItem.style.width = '100%';
  deleteItem.style.textAlign = 'left';
  deleteItem.style.padding = '6px 8px';
  deleteItem.style.border = '1px solid transparent';
  deleteItem.style.borderRadius = '4px';
  deleteItem.style.background = '#fff';
  deleteItem.style.cursor = 'pointer';
  deleteItem.style.whiteSpace = 'nowrap';

  deleteItem.addEventListener('mouseover', () => { deleteItem.style.background = '#f6f6f6'; });
  deleteItem.addEventListener('mouseout', () => { deleteItem.style.background = '#fff'; });

  row.appendChild(drag);
  row.appendChild(checkbox);
  row.appendChild(text);
  menu.appendChild(deleteItem);
  menuWrap.appendChild(menuBtn);
  menuWrap.appendChild(menu);
  row.appendChild(menuWrap);

  if (task.jiraUrl || task.jiraText) {
    const jiraView = el('div', { className: 'tm-jira-link-wrap' });
    jiraView.style.flexBasis = '100%';
    jiraView.style.marginTop = '4px';
    jiraView.style.overflow = 'hidden';
    const linkText = task.jiraText || task.jiraUrl || '';
    const jiraA = el('a', { href: task.jiraUrl || '#', text: linkText, target: '_blank', rel: 'noopener noreferrer' });
    jiraA.style.color = '#3572b0';
    jiraA.style.textDecoration = 'underline';
    jiraA.style.display = 'inline-block';
    jiraA.style.maxWidth = '100%';
    jiraA.style.whiteSpace = 'nowrap';
    jiraA.style.overflow = 'hidden';
    jiraA.style.textOverflow = 'ellipsis';
    jiraView.appendChild(jiraA);
    row.appendChild(jiraView);
  }

  checkbox.addEventListener('change', () => {
    const tasks = loadTasks();
    const idx = tasks.findIndex((x) => String(x.id) === String(task.id));
    if (idx !== -1) {
      tasks[idx].done = !!checkbox.checked;
      saveTasks(tasks);
      const list = row.parentElement;
      if (list) {
        rerenderList(list, tasks, renderItem);
      }
    }
  });

  text.addEventListener('click', () => { startEditMode(row, task); });

  menuBtn.addEventListener('click', () => {
    const allMenus = document.querySelectorAll('.tm-item-menu');
    allMenus.forEach((m) => {
      if (m !== menu) {
        m.style.display = 'none';
      }
    });
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  });

  deleteItem.addEventListener('click', () => {
    const tasks = loadTasks();
    const next = tasks.filter((x) => String(x.id) !== String(task.id));
    saveTasks(next);
    const list = row.parentElement;
    if (list) {
      rerenderList(list, next, renderItem);
    }
  });

  // DnD
  drag.addEventListener('mousedown', (e) => {
    startDrag(row, e);
  });

  return row;
}

/**
 * Переход в режим редактирования
 */
export function startEditMode(row, task) {
  const currentTextEl = row.querySelector('.tm-item-text');
  if (!currentTextEl) {
    return;
  }

  const input = el('textarea', { rows: '1', wrap: 'soft' });
  input.value = task.text;
  input.style.flex = '1';
  input.style.padding = '4px 6px';
  input.style.border = '1px solid #dcdcdc';
  input.style.borderRadius = '6px';
  input.style.resize = 'none';
  input.style.overflow = 'hidden';
  input.style.lineHeight = '1.4';

  const saveBtn = el('button', { type: 'button', text: 'Сохранить' });
  saveBtn.style.padding = '4px 8px';
  saveBtn.style.border = '1px solid #3a873a';
  saveBtn.style.borderRadius = '6px';
  saveBtn.style.background = '#4caf50';
  saveBtn.style.color = '#fff';
  saveBtn.style.cursor = 'pointer';

  const cancelBtn = el('button', { type: 'button', text: 'Отмена' });
  cancelBtn.style.padding = '4px 8px';
  cancelBtn.style.border = '1px solid #bdbdbd';
  cancelBtn.style.borderRadius = '6px';
  cancelBtn.style.background = '#f3f3f3';
  cancelBtn.style.cursor = 'pointer';

  row.replaceChild(input, currentTextEl);
  const oldMenuWrap = row.querySelector('.tm-menu-wrap');
  if (oldMenuWrap) {
    row.removeChild(oldMenuWrap);
  }
  row.style.flexWrap = 'wrap';
  row.dataset.editing = '1';
  const dragHandle = row.querySelector('.tm-drag');
  if (dragHandle) {
    dragHandle.style.cursor = 'not-allowed';
    dragHandle.style.opacity = '0.5';
    dragHandle.style.pointerEvents = 'none';
  }
  row.draggable = false;

  const actions = el('div', { className: 'tm-edit-actions' });
  actions.style.display = 'flex';
  actions.style.gap = '8px';
  actions.style.marginTop = '6px';
  actions.style.flexBasis = '100%';

  let jiraEnabled = !!(task.jiraUrl);
  let jiraViewRef = null;
  const jiraBtn = el('button', { type: 'button' });
  jiraBtn.style.padding = '4px 8px';
  jiraBtn.style.border = '1px solid #bdbdbd';
  jiraBtn.style.borderRadius = '6px';
  jiraBtn.style.background = '#f3f3f3';
  jiraBtn.style.cursor = 'pointer';
  const setJiraBtnText = () => { jiraBtn.textContent = jiraEnabled ? '− Jira' : '+ Jira'; };
  setJiraBtnText();

  const jiraWrap = el('div', { className: 'tm-jira-edit' });
  jiraWrap.style.display = 'none';
  jiraWrap.style.flexBasis = '94%';
  jiraWrap.style.marginTop = '6px';
  const jiraInput = el('input', { type: 'text', placeholder: '[[UI-5320] Название](https://jira.theteamsoft.com/browse/UI-5320)' });
  jiraInput.style.width = '100%';
  jiraInput.style.padding = '6px 8px';
  jiraInput.style.border = '1px solid #dcdcdc';
  jiraInput.style.borderRadius = '6px';
  jiraWrap.appendChild(jiraInput);

  const toMarkdown = (text, url) => (text && url ? `[${text}](${url})` : (url ? url : ''));
  const fromMarkdown = (src) => {
    if (!src) {
      return null;
    }
    const m = src.match(/^\s*\[(.+?)\]\((https?:\/\/[^)\s]+)\)\s*$/);
    if (m) return { text: m[1], url: m[2] };
    const urlMatch = src.match(/https?:\/\/[^\s)]+/);
    if (urlMatch) return { text: src.replace(urlMatch[0], '').trim() || urlMatch[0], url: urlMatch[0] };
    return null;
  };

  jiraBtn.addEventListener('click', () => {
    jiraEnabled = !jiraEnabled;
    setJiraBtnText();
    if (jiraEnabled) {
      jiraWrap.style.display = 'block';
      if (!jiraInput.value) {
        jiraInput.value = toMarkdown(task.jiraText || '', task.jiraUrl || '');
      }
      jiraInput.focus();
      if (jiraViewRef) {
        jiraViewRef.style.display = 'block';
      }
    } else {
      jiraWrap.style.display = 'none';
      if (jiraViewRef) {
        jiraViewRef.style.display = 'none';
      }
    }
  });

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);
  actions.appendChild(jiraBtn);
  row.appendChild(actions);
  autosizeTextarea(input);
  const hintEdit = el('div', { className: 'tm-hint-edit', text: 'Enter — сохранить, Shift+Enter — новая строка, Esc — отменить' });
  hintEdit.style.fontSize = '12px';
  hintEdit.style.color = '#777';
  hintEdit.style.flexBasis = '100%';
  hintEdit.style.marginTop = '2px';
  row.appendChild(hintEdit);
  row.appendChild(jiraWrap);
  jiraViewRef = row.querySelector('.tm-jira-link-wrap') || null;

  input.focus();
  input.select();

  saveBtn.addEventListener('click', () => {
    const val = String(input.value || '').trim();
    if (val.length === 0) {
      return;
    }
    const tasks = loadTasks();
    const idx = tasks.findIndex((x) => String(x.id) === String(task.id));
    if (idx !== -1) {
      tasks[idx].text = val;
      if (!jiraEnabled) {
        delete tasks[idx].jiraUrl;
        delete tasks[idx].jiraText;
      } else {
        if (jiraWrap.style.display !== 'none' && jiraInput.value.trim()) {
          const parsed = fromMarkdown(jiraInput.value.trim());
          if (parsed) {
            tasks[idx].jiraUrl = parsed.url;
            tasks[idx].jiraText = parsed.text;
          }
        } else if (task.jiraUrl) {
          tasks[idx].jiraUrl = task.jiraUrl;
          tasks[idx].jiraText = task.jiraText;
        }
      }
      saveTasks(tasks);
      const list = row.parentElement;
      if (list) {
        rerenderList(list, tasks, renderItem);
      }
    }
  });

  cancelBtn.addEventListener('click', () => {
    const list = row.parentElement;
    if (list) {
      rerenderList(list, loadTasks(), renderItem);
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveBtn.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelBtn.click();
    }
  });
}
