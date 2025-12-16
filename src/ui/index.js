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
 * Извлечь дату из текста
 */
function extractDueDate(text) {
  const match = text.match(/@([a-zа-яё]+)/i);
  if (!match) {
    return null;
  }
  const keyword = match[1].toLowerCase();
  const dateMap = {
    today: 'today',
    tomorrow: 'tomorrow',
    thisweek: 'thisweek',
    nextweek: 'nextweek',
    later: 'later',
    forgotten: 'forgotten',
    сегодня: 'today',
    завтра: 'tomorrow',
    этанеделя: 'thisweek',
    следнеделя: 'nextweek',
    позже: 'later',
    позднее: 'later',
    забыто: 'forgotten',
  };
  const normalizedKey = dateMap[keyword];
  if (!normalizedKey) {
    return null;
  }
  return parseDateKeyword(normalizedKey);
}

/**
 * Преобразовать ключевое слово в дату
 */
function parseDateKeyword(keyword) {
  const now = new Date();
  const labels = {
    today: 'Сегодня',
    tomorrow: 'Завтра',
    thisweek: 'Эта неделя',
    nextweek: 'След.неделя',
    later: 'Позже',
    forgotten: 'Забыто',
  };
  let targetDate = new Date(now);
  let startDate = null;
  switch (keyword) {
    case 'today':
      break;
    case 'tomorrow':
      targetDate.setDate(now.getDate() + 1);
      break;
    case 'thisweek':
      startDate = new Date(now);
      targetDate.setDate(now.getDate() + (7 - now.getDay()));
      break;
    case 'nextweek':
      startDate = new Date(now);
      startDate.setDate(now.getDate() + (7 - now.getDay()) + 1);
      targetDate.setDate(now.getDate() + (14 - now.getDay()));
      break;
    case 'later':
      targetDate.setDate(now.getDate() + 30);
      break;
    case 'forgotten':
      targetDate.setDate(now.getDate() - 365);
      break;
    default:
      return null;
  }
  return {
    date: targetDate.toISOString().split('T')[0],
    label: labels[keyword],
    startDate: startDate ? startDate.toISOString().split('T')[0] : null,
    type: keyword,
  };
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
 * Сортировка задач: выполненные задачи в конец
 */
function sortTasksWithDoneAtEnd(tasks) {
  const notDone = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  return [...notDone, ...done];
}

/**
 * Рендер UI todo-листа
 */
export function renderUI(root, initialTasks) {
  window.__tmRerenderList = rerenderList;
  window.__tmRenderItem = renderItem;

  // Состояние сортировки
  let isSortedByDate = false;

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

  // Панель сортировки
  const sortBar = el('div', { className: 'tm-sort-bar' });
  sortBar.style.display = 'flex';
  sortBar.style.gap = '8px';
  sortBar.style.marginBottom = '10px';

  const sortByDateBtn = el('button', { type: 'button', text: '⇅ По дате' });
  sortByDateBtn.style.padding = '6px 12px';
  sortByDateBtn.style.borderRadius = '6px';
  sortByDateBtn.style.cursor = 'pointer';
  sortByDateBtn.style.fontSize = '13px';
  sortByDateBtn.style.fontWeight = '400';
  sortByDateBtn.style.transition = 'background 0.2s ease, border-color 0.2s ease, color 0.2s ease';

  // Функции для управления стилями кнопки
  const applyInactiveStyle = () => {
    sortByDateBtn.style.border = '1px solid #b0bec5';
    sortByDateBtn.style.background = '#eceff1';
    sortByDateBtn.style.color = '#607d8b';
  };

  const applyActiveStyle = () => {
    sortByDateBtn.style.border = '1px solid #90caf9';
    sortByDateBtn.style.background = '#e3f2fd';
    sortByDateBtn.style.color = '#1976d2';
  };

  const applyHoverStyle = () => {
    if (isSortedByDate) {
      sortByDateBtn.style.background = '#bbdefb';
    } else {
      sortByDateBtn.style.background = '#cfd8dc';
    }
  };

  const applyDefaultStyle = () => {
    if (isSortedByDate) {
      applyActiveStyle();
    } else {
      applyInactiveStyle();
    }
  };

  // Изначально неактивная
  applyInactiveStyle();

  sortByDateBtn.addEventListener('mouseover', applyHoverStyle);
  sortByDateBtn.addEventListener('mouseout', applyDefaultStyle);

  sortBar.appendChild(sortByDateBtn);

  // Глобальная функция для деактивации кнопки (вызывается при DnD)
  window.__tmDeactivateSortButton = () => {
    isSortedByDate = false;
    applyInactiveStyle();
  };

  // Список
  const list = el('div', { id: 'tm-list' });
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '6px';
  const sortedInitialTasks = sortTasksWithDoneAtEnd(initialTasks);
  sortedInitialTasks.forEach((t) => list.appendChild(renderItem(t)));

  // Панель API
  // const apiBar = el('div', { className: 'tm-api-bar' });
  // apiBar.style.display = 'flex';
  // apiBar.style.gap = '8px';
  // apiBar.style.margin = '6px 0 10px';

  // const btnSearchMy = el('button', { type: 'button', text: 'API: Мои задачи' });
  // btnSearchMy.style.padding = '4px 8px';
  // btnSearchMy.style.border = '1px solid #3572b0';
  // btnSearchMy.style.borderRadius = '6px';
  // btnSearchMy.style.background = '#e8f2fd';
  // btnSearchMy.style.cursor = 'pointer';
  // btnSearchMy.addEventListener('click', () => {
  //   jiraRequest({
  //     method: 'POST',
  //     url: 'https://jira.theteamsoft.com/rest/api/2/search',
  //     body: {
  //       jql: 'assignee = currentUser() ORDER BY created DESC',
  //       maxResults: 10,
  //       fields: ['key', 'summary', 'status'],
  //     },
  //     message: 'tpm: +++ search my issues',
  //   });
  // });

  // const btnServerInfo = el('button', { type: 'button', text: 'API: ServerInfo' });
  // btnServerInfo.style.padding = '4px 8px';
  // btnServerInfo.style.border = '1px solid #3572b0';
  // btnServerInfo.style.borderRadius = '6px';
  // btnServerInfo.style.background = '#e8f2fd';
  // btnServerInfo.style.cursor = 'pointer';
  // btnServerInfo.addEventListener('click', () => {
  //   jiraRequest({ method: 'GET', url: 'https://jira.theteamsoft.com/rest/api/2/serverInfo', message: 'tpm: +++ serverInfo' });
  // });

  // apiBar.appendChild(btnSearchMy);
  // apiBar.appendChild(btnServerInfo);

  // Вставка в root
  // root.appendChild(apiBar);
  root.appendChild(form);
  root.appendChild(sortBar);
  root.appendChild(list);

  // Обработчик сортировки по дате
  sortByDateBtn.addEventListener('click', () => {
    const tasks = loadTasks();
    
    // Разделяем на выполненные и невыполненные
    const notDoneTasks = tasks.filter((t) => !t.done);
    const doneTasks = tasks.filter((t) => t.done);
    
    // Сортируем только невыполненные задачи
    const notDoneWithDate = notDoneTasks.filter((t) => t.dueDate);
    const notDoneWithoutDate = notDoneTasks.filter((t) => !t.dueDate);

    // Сортируем задачи с датой по возрастанию (сегодня первыми)
    notDoneWithDate.sort((a, b) => {
      const dateA = new Date(a.dueDate);
      const dateB = new Date(b.dueDate);
      return dateA - dateB;
    });

    // Объединяем: сначала невыполненные (с датой, потом без даты), затем все выполненные
    const sorted = [...notDoneWithDate, ...notDoneWithoutDate, ...doneTasks];
    saveTasks(sorted);
    rerenderList(list, sorted, renderItem);

    // Активируем кнопку
    isSortedByDate = true;
    applyActiveStyle();
  });

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
    const dueDateData = extractDueDate(val);
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
      taskText = taskText.replace(/\b[A-Z]+-\d+\b/, '').trim();
    }
    if (dueDateData) {
      taskText = taskText.replace(/@[a-zа-яё]+/i, '').trim();
    }
    const current = loadTasks();
    const newTask = { id: Date.now(), text: taskText, done: false, createdAt: Date.now() };
    if (jiraData && !jiraData.error) {
      newTask.jiraKey = jiraData.key;
      newTask.jiraSummary = jiraData.summary;
      newTask.jiraUrl = jiraData.url;
    }
    if (dueDateData) {
      newTask.dueDate = dueDateData.date;
      newTask.dueDateLabel = dueDateData.label;
      newTask.dueDateStart = dueDateData.startDate;
      newTask.dueDateType = dueDateData.type;
    }
    const next = [...current, newTask];
    const sortedNext = sortTasksWithDoneAtEnd(next);
    saveTasks(sortedNext);
    input.value = '';
    input.dispatchEvent(new Event('input'));
    addBtn.disabled = false;
    addBtn.textContent = '➤';
    rerenderList(list, sortedNext, renderItem);
    input.focus();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addBtn.click();
    }
  });
}
