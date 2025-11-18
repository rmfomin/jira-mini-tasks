import { el, autosizeTextarea } from '../utils/dom.js';
import { jiraRequest } from '../api/jira.js';
import { loadTasks, saveTasks } from '../storage/index.js';
import { rerenderList } from './rerender.js';
import { renderItem } from './item.js';

/**
 * Рендер UI todo-листа
 */
export function renderUI(root, initialTasks) {
  // Форма
  const form = el('div', { className: 'tm-form' });
  form.style.display = 'flex';
  form.style.gap = '8px';
  form.style.marginBottom = '10px';
  form.style.flexWrap = 'wrap';

  const input = el('textarea', { placeholder: 'Новая задача…', id: 'tm-input', rows: '1', wrap: 'soft' });
  input.style.flex = '1';
  input.style.padding = '6px 8px';
  input.style.border = '1px solid #dcdcdc';
  input.style.borderRadius = '6px';
  input.style.resize = 'none';
  input.style.overflow = 'hidden';
  input.style.lineHeight = '1.4';

  const addBtn = el('button', { type: 'button', id: 'tm-add-btn', text: '➤' });
  addBtn.style.padding = '6px 10px';
  addBtn.style.border = '1px solid #3572b0';
  addBtn.style.borderRadius = '6px';
  addBtn.style.background = '#4a9ae9';
  addBtn.style.color = '#fff';
  addBtn.style.cursor = 'pointer';
  addBtn.style.height = '32px';
  addBtn.style.display = 'inline-flex';
  addBtn.style.alignItems = 'center';
  addBtn.style.justifyContent = 'center';
  addBtn.style.flex = '0 0 auto';
  addBtn.style.alignSelf = 'flex-start';

  form.appendChild(input);
  form.appendChild(addBtn);
  const hintAdd = el('div', { className: 'tm-hint-add', text: 'Ctrl/Cmd+Enter — добавить' });
  hintAdd.style.fontSize = '12px';
  hintAdd.style.color = '#777';
  hintAdd.style.flexBasis = '100%';
  hintAdd.style.marginTop = '-4px';
  form.appendChild(hintAdd);
  autosizeTextarea(input);

  // Список
  const list = el('div', { id: 'tm-list' });
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '6px';
  initialTasks.forEach((t) => list.appendChild(renderItem(t)));

  // Панель API
  const apiBar = el('div', { className: 'tm-api-bar' });
  apiBar.style.display = 'flex';
  apiBar.style.gap = '8px';
  apiBar.style.margin = '6px 0 10px';

  const btnSearchMy = el('button', { type: 'button', text: 'API: Мои задачи' });
  btnSearchMy.style.padding = '4px 8px';
  btnSearchMy.style.border = '1px solid #3572b0';
  btnSearchMy.style.borderRadius = '6px';
  btnSearchMy.style.background = '#e8f2fd';
  btnSearchMy.style.cursor = 'pointer';
  btnSearchMy.addEventListener('click', () => {
    jiraRequest({
      method: 'POST',
      url: 'https://jira.theteamsoft.com/rest/api/2/search',
      body: {
        jql: 'assignee = currentUser() ORDER BY created DESC',
        maxResults: 10,
        fields: ['key', 'summary', 'status'],
      },
      message: 'tpm: +++ search my issues',
    });
  });

  const btnServerInfo = el('button', { type: 'button', text: 'API: ServerInfo' });
  btnServerInfo.style.padding = '4px 8px';
  btnServerInfo.style.border = '1px solid #3572b0';
  btnServerInfo.style.borderRadius = '6px';
  btnServerInfo.style.background = '#e8f2fd';
  btnServerInfo.style.cursor = 'pointer';
  btnServerInfo.addEventListener('click', () => {
    jiraRequest({ method: 'GET', url: 'https://jira.theteamsoft.com/rest/api/2/serverInfo', message: 'tpm: +++ serverInfo' });
  });

  apiBar.appendChild(btnSearchMy);
  apiBar.appendChild(btnServerInfo);

  // Вставка в root
  root.appendChild(form);
  root.appendChild(apiBar);
  root.appendChild(list);

  // Обработчики
  addBtn.addEventListener('click', () => {
    const val = String(input.value || '').trim();
    if (!val) return;
    const current = loadTasks();
    const next = [
      ...current,
      { id: Date.now(), text: val, done: false, createdAt: Date.now() },
    ];
    saveTasks(next);
    input.value = '';
    input.dispatchEvent(new Event('input'));
    rerenderList(list, next, renderItem);
    input.focus();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      addBtn.click();
    }
  });
}

