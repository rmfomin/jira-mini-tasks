import { el, autosizeTextarea } from '../utils/dom.js';
import { jiraRequest } from '../api/jira.js';
import { loadTasks, saveTasks } from '../storage/index.js';
import { rerenderList } from './rerender.js';
import { renderItem } from './item.js';

/**
 * Извлечь Jira issue key из текста
 */
function extractJiraKey(text) {
  const match = text.match(/\b([A-Z]+-\d+)\b/);
  return match ? match[1] : null;
}

/**
 * Загрузить данные задачи из Jira API
 */
async function fetchJiraIssue(issueKey) {
  try {
    const response = await fetch(`https://jira.theteamsoft.com/rest/api/2/issue/${issueKey}?fields=summary`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (data.errorMessages || data.errors) {
      return { error: true };
    }
    return {
      key: data.key,
      summary: data.fields.summary,
      url: `https://jira.theteamsoft.com/browse/${data.key}`,
    };
  } catch (err) {
    console.error('tpm: Ошибка загрузки Jira issue:', err);
    return { error: true };
  }
}

/**
 * Рендер UI todo-листа
 */
export function renderUI(root, initialTasks) {
  window.__tmRerenderList = rerenderList;
  window.__tmRenderItem = renderItem;

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
  const hintAdd = el('div', { className: 'tm-hint-add', text: 'Enter — добавить, Shift+Enter — новая строка' });
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
  addBtn.addEventListener('click', async () => {
    const val = String(input.value || '').trim();
    if (!val) {
      return;
    }
    addBtn.disabled = true;
    addBtn.textContent = '⏳';
    input.style.border = '1px solid #dcdcdc';
    const jiraKey = extractJiraKey(val);
    let jiraData = null;
    let taskText = val;
    if (jiraKey) {
      jiraData = await fetchJiraIssue(jiraKey);
      if (jiraData.error) {
        input.style.border = '2px solid #d32f2f';
        addBtn.disabled = false;
        addBtn.textContent = '➤';
        return;
      }
      taskText = val.replace(/\b[A-Z]+-\d+\b/, '').trim();
    }
    const current = loadTasks();
    const newTask = { id: Date.now(), text: taskText, done: false, createdAt: Date.now() };
    if (jiraData && !jiraData.error) {
      newTask.jiraKey = jiraData.key;
      newTask.jiraSummary = jiraData.summary;
      newTask.jiraUrl = jiraData.url;
    }
    const next = [...current, newTask];
    saveTasks(next);
    input.value = '';
    input.dispatchEvent(new Event('input'));
    addBtn.disabled = false;
    addBtn.textContent = '➤';
    rerenderList(list, next, renderItem);
    input.focus();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addBtn.click();
    }
  });
}
