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
  checkbox.style.transform = 'scale(1.5)';
  checkbox.style.margin = '0';
  checkbox.style.marginRight = '16px';
  checkbox.style.marginLeft = '8px';

  const text = el('span', { className: 'tm-item-text', text: task.text });
  text.style.flex = '1';
  text.style.userSelect = 'none';
  text.style.wordBreak = 'break-word';
  text.style.whiteSpace = 'pre-wrap';
  text.style.cursor = 'text';
  text.style.fontSize = '15px';
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

  const linksWrap = el('div', { className: 'tm-links-wrap' });
  linksWrap.style.flexBasis = '100%';
  linksWrap.style.marginTop = '10px';
  linksWrap.style.display = 'flex';
  linksWrap.style.gap = '10px';
  linksWrap.style.flexWrap = 'wrap';
  linksWrap.style.height = '30px';

  if (task.jiraKey && task.jiraSummary) {
    const truncatedSummary = task.jiraSummary.length > 25 ? task.jiraSummary.substring(0, 25) + '…' : task.jiraSummary;
    const jiraBtnWrap = el('div', { className: 'tm-jira-btn-wrap' });
    jiraBtnWrap.style.position = 'relative';
    jiraBtnWrap.style.display = 'inline-block';
    jiraBtnWrap.style.lineHeight = '0';
    const jiraBtn = el('button', { type: 'button', title: task.jiraSummary });
    jiraBtn.style.padding = '6px 12px';
    jiraBtn.style.height = '100%';
    jiraBtn.style.border = '1px solid #d0d0d0';
    jiraBtn.style.borderRadius = '8px';
    jiraBtn.style.background = '#f5f5f5';
    jiraBtn.style.color = '#424242';
    jiraBtn.style.cursor = 'pointer';
    jiraBtn.style.fontSize = '12px';
    jiraBtn.style.fontWeight = '400';
    jiraBtn.style.lineHeight = '1';
    jiraBtn.style.whiteSpace = 'nowrap';
    jiraBtn.style.overflow = 'hidden';
    jiraBtn.style.textOverflow = 'ellipsis';
    jiraBtn.style.transition = 'background 0.2s ease';
    jiraBtn.style.textAlign = 'left';
    jiraBtn.style.display = 'flex';
    jiraBtn.style.alignItems = 'center';
    jiraBtn.style.gap = '6px';
    jiraBtn.style.position = 'relative';
    const jiraIcon = el('img');
    jiraIcon.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAALqSURBVHgB7ZdNT9RAGMefaTvtwbe6HDQhJnsBPG5i/AB8A4kfYCGe8KQxngwwVeJJIwcP3mg8G/UbrN9AjwYkbowElQjIKtB2puMzLWtg6cu065F/0nSYl/5/M8/MMyzAqYZQcz5YGF+UCzCEDKipc7c+twkAwyIbBqIewM33bcMAn9p2v6Y2RHUANAcp/PONkcGWWhCVANzZLzcIxD4uPViOndWlMoQ2wJnpldZ+r7dsmGZZ10oQWgDu7R8ty7Y7lDouvsGwLAj29+F/QJQCjN7fbjmO0UFjNKdgUXwQItjbKxvKJhblnbJOhQBjTLao43TQ1LWoDaZ1CIDvvV4PeBgWDQcJ8Gz8sWxDHYCrTDaJCW/Q2FXHjSYzp6DK6q32wub6OpQqBr8Iwsgzjyl0gEBTGZk0nTn9twp28rcQwpMxzMAQECTXXELzaD2aAY/CZNl5GEHEQ2/r+ShTbWMP5TQxYBnKOCRMfpoj73IB8syPQSCAOAi8r08vsqNtmhA7ksDk6gPyoV9xLARF5kpmGo4T5kqr88TXCIdLJHSaTLqZADqyLEvmtQkeXZBSgoayAYwIJjEo3ZLBmUlm9N52O4rCJcE5FEAkIegy0s0E+IgNdSDc2Y12yEOfR1G6R7IhTsRfiWR9vWwzHgVZX1npmjb11VGltoPH08J9Yqf5Ast9CyFham2OvB38AMn7si7E1vdv8OfXbpKeVbIyD5OVyhfpGyEMMoMz97PG525C3XA0Ll0GQggIzBERhkCEUZInhAoHPrHgueaFAH0IjOQUFneK+p11XYhUglKJiqf7QJlH4cHdNWb7RWNLj6HaNGrzFEGcbzSSGYvENF0JHgTexpORJSiRVh4og0j+ScEw8MPlRwhv68UVBhrSTkQ6KyFjgasQeAcvJxhoqlImVBB4oUwN1sd4R6hHgvTiV9cYVFDlVKxus8Gc/3tHLYr04PV1BhVV63fB4MWz+3OzlvnQUlfw+CPJ4FRD6C9T03iJQ2mrcgAAAABJRU5ErkJggg==';
    jiraIcon.alt = 'Jira';
    jiraIcon.style.width = '16px';
    jiraIcon.style.height = '16px';
    jiraIcon.style.flexShrink = '0';
    const textSpan = el('span', { text: `${task.jiraKey} | ${truncatedSummary}` });
    textSpan.style.overflow = 'hidden';
    textSpan.style.textOverflow = 'ellipsis';
    textSpan.style.whiteSpace = 'nowrap';
    const gradient = el('div', { className: 'tm-btn-gradient' });
    gradient.style.position = 'absolute';
    gradient.style.top = '0';
    gradient.style.right = '0';
    gradient.style.bottom = '0';
    gradient.style.width = '50px';
    gradient.style.background = 'linear-gradient(to right, rgba(245, 245, 245, 0), rgba(245, 245, 245, 1) 50%)';
    gradient.style.pointerEvents = 'none';
    gradient.style.opacity = '0';
    gradient.style.transition = 'opacity 0.2s ease';
    gradient.style.borderRadius = '0 8px 8px 0';
    const closeBtn = el('button', { type: 'button', text: '×', title: 'Удалить Jira-задачу' });
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '50%';
    closeBtn.style.right = '4px';
    closeBtn.style.transform = 'translateY(-50%)';
    closeBtn.style.width = '20px';
    closeBtn.style.height = '20px';
    closeBtn.style.padding = '0';
    closeBtn.style.border = 'none';
    closeBtn.style.background = 'transparent';
    closeBtn.style.color = '#666';
    closeBtn.style.fontSize = '20px';
    closeBtn.style.lineHeight = '1';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.opacity = '0';
    closeBtn.style.transition = 'opacity 0.2s ease, color 0.1s ease';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.addEventListener('mouseover', () => { closeBtn.style.color = '#d32f2f'; });
    closeBtn.addEventListener('mouseout', () => { closeBtn.style.color = '#666'; });
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tasks = loadTasks();
      const idx = tasks.findIndex((x) => String(x.id) === String(task.id));
      if (idx !== -1) {
        delete tasks[idx].jiraKey;
        delete tasks[idx].jiraSummary;
        delete tasks[idx].jiraUrl;
        saveTasks(tasks);
        const list = row.parentElement;
        if (list) {
          rerenderList(list, tasks, renderItem);
        }
      }
    });
    jiraBtn.appendChild(jiraIcon);
    jiraBtn.appendChild(textSpan);
    jiraBtn.appendChild(gradient);
    jiraBtn.appendChild(closeBtn);
    jiraBtnWrap.appendChild(jiraBtn);
    jiraBtnWrap.addEventListener('mouseover', () => {
      jiraBtn.style.background = '#e8e8e8';
      gradient.style.background = 'linear-gradient(to right, rgba(232, 232, 232, 0), rgba(232, 232, 232, 1) 50%)';
      gradient.style.opacity = '1';
      closeBtn.style.opacity = '1';
    });
    jiraBtnWrap.addEventListener('mouseout', () => {
      jiraBtn.style.background = '#f5f5f5';
      gradient.style.background = 'linear-gradient(to right, rgba(245, 245, 245, 0), rgba(245, 245, 245, 1) 50%)';
      gradient.style.opacity = '0';
      closeBtn.style.opacity = '0';
    });
    jiraBtn.addEventListener('click', () => {
      window.open(task.jiraUrl || `https://jira.theteamsoft.com/browse/${task.jiraKey}`, '_blank', 'noopener,noreferrer');
    });
    linksWrap.appendChild(jiraBtnWrap);
  }

  if (task.dueDate && task.dueDateLabel) {
    const overdue = isOverdue(task.dueDate);
    let titleText = '';
    if (task.dueDateType === 'thisweek' || task.dueDateType === 'nextweek') {
      if (task.dueDateStart) {
        titleText = formatDateRange(task.dueDateStart, task.dueDate);
      }
    } else if (task.dueDateType !== 'later') {
      titleText = formatDateDisplay(task.dueDate);
    }
    const dateBtnWrap = el('div', { className: 'tm-date-btn-wrap' });
    dateBtnWrap.style.position = 'relative';
    dateBtnWrap.style.display = 'inline-block';
    dateBtnWrap.style.lineHeight = '0';
    const dateBtn = el('button', { type: 'button', title: titleText });
    dateBtn.style.padding = '6px 12px';
    dateBtn.style.height = '100%';
    dateBtn.style.border = overdue ? '1px solid #c62828' : '1px solid #d0d0d0';
    dateBtn.style.borderRadius = '8px';
    dateBtn.style.background = overdue ? '#ffebee' : '#f5f5f5';
    dateBtn.style.color = overdue ? '#c62828' : '#424242';
    dateBtn.style.cursor = 'default';
    dateBtn.style.fontSize = '12px';
    dateBtn.style.fontWeight = '400';
    dateBtn.style.lineHeight = '1';
    dateBtn.style.whiteSpace = 'nowrap';
    dateBtn.style.display = 'flex';
    dateBtn.style.alignItems = 'center';
    dateBtn.style.gap = '6px';
    dateBtn.style.transition = 'background 0.2s ease';
    dateBtn.style.position = 'relative';
    const dateText = overdue ? formatDateDisplay(task.dueDate) : task.dueDateLabel;
    dateBtn.textContent = `＠ ${dateText}`;
    const gradientBg = overdue ? '#ffebee' : '#f5f5f5';
    const gradientHoverBg = overdue ? '#ffcdd2' : '#e8e8e8';
    const gradient = el('div', { className: 'tm-btn-gradient' });
    gradient.style.position = 'absolute';
    gradient.style.top = '0';
    gradient.style.right = '0';
    gradient.style.bottom = '0';
    gradient.style.width = '50px';
    gradient.style.background = `linear-gradient(to right, ${hexToRgba(gradientBg, 0)} 0%, ${hexToRgba(gradientBg, 1)} 50%)`;
    gradient.style.pointerEvents = 'none';
    gradient.style.opacity = '0';
    gradient.style.transition = 'opacity 0.2s ease';
    gradient.style.borderRadius = '0 8px 8px 0';
    const closeBtn = el('button', { type: 'button', text: '×', title: 'Удалить дату' });
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '50%';
    closeBtn.style.right = '4px';
    closeBtn.style.transform = 'translateY(-50%)';
    closeBtn.style.width = '20px';
    closeBtn.style.height = '20px';
    closeBtn.style.padding = '0';
    closeBtn.style.border = 'none';
    closeBtn.style.background = 'transparent';
    closeBtn.style.color = overdue ? '#c62828' : '#666';
    closeBtn.style.fontSize = '20px';
    closeBtn.style.lineHeight = '1';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.opacity = '0';
    closeBtn.style.transition = 'opacity 0.2s ease, color 0.1s ease';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.addEventListener('mouseover', () => { closeBtn.style.color = '#d32f2f'; });
    closeBtn.addEventListener('mouseout', () => { closeBtn.style.color = overdue ? '#c62828' : '#666'; });
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tasks = loadTasks();
      const idx = tasks.findIndex((x) => String(x.id) === String(task.id));
      if (idx !== -1) {
        delete tasks[idx].dueDate;
        delete tasks[idx].dueDateLabel;
        delete tasks[idx].dueDateStart;
        delete tasks[idx].dueDateType;
        saveTasks(tasks);
        const list = row.parentElement;
        if (list) {
          rerenderList(list, tasks, renderItem);
        }
      }
    });
    dateBtn.appendChild(gradient);
    dateBtn.appendChild(closeBtn);
    dateBtnWrap.appendChild(dateBtn);
    dateBtnWrap.addEventListener('mouseover', () => {
      dateBtn.style.background = gradientHoverBg;
      gradient.style.background = `linear-gradient(to right, ${hexToRgba(gradientHoverBg, 0)} 0%, ${hexToRgba(gradientHoverBg, 1)} 50%)`;
      gradient.style.opacity = '1';
      closeBtn.style.opacity = '1';
    });
    dateBtnWrap.addEventListener('mouseout', () => {
      dateBtn.style.background = gradientBg;
      gradient.style.background = `linear-gradient(to right, ${hexToRgba(gradientBg, 0)} 0%, ${hexToRgba(gradientBg, 1)} 50%)`;
      gradient.style.opacity = '0';
      closeBtn.style.opacity = '0';
    });
    linksWrap.appendChild(dateBtnWrap);
  }

  if (linksWrap.children.length > 0) {
    row.appendChild(linksWrap);
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
 * Форматировать дату для отображения
 */
function formatDateDisplay(dateStr) {
  const date = new Date(dateStr);
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

/**
 * Форматировать интервал дат
 */
function formatDateRange(startDateStr, endDateStr) {
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  const monthsShort = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  if (startDate.getMonth() === endDate.getMonth()) {
    return `${startDate.getDate()} - ${endDate.getDate()} ${monthsShort[endDate.getMonth()]}`;
  }
  return `${startDate.getDate()} ${monthsShort[startDate.getMonth()]} - ${endDate.getDate()} ${monthsShort[endDate.getMonth()]}`;
}

/**
 * Проверить, просрочена ли дата
 */
function isOverdue(dateStr) {
  const now = new Date();
  const due = new Date(dateStr);
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < now;
}

/**
 * Конвертировать hex в rgba
 */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);
  row.appendChild(actions);
  autosizeTextarea(input);
  const hintEdit = el('div', { className: 'tm-hint-edit', text: 'Enter — сохранить, Shift+Enter — новая строка, Esc — отменить' });
  hintEdit.style.fontSize = '12px';
  hintEdit.style.color = '#777';
  hintEdit.style.flexBasis = '100%';
  hintEdit.style.marginTop = '2px';
  row.appendChild(hintEdit);

  input.focus();
  input.select();

  saveBtn.addEventListener('click', async () => {
    const val = String(input.value || '').trim();
    if (val.length === 0) {
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳';
    input.style.border = '1px solid #dcdcdc';
    const jiraKey = extractJiraKey(val);
    const dueDateData = extractDueDate(val);
    let jiraData = null;
    let taskText = val;
    if (jiraKey) {
      jiraData = await fetchJiraIssue(jiraKey);
      if (jiraData.error) {
        input.style.border = '2px solid #d32f2f';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Сохранить';
        return;
      }
      taskText = taskText.replace(/\b[A-Z]+-\d+\b/, '').trim();
    }
    if (dueDateData) {
      taskText = taskText.replace(/@[a-zа-яё]+/i, '').trim();
    }
    const tasks = loadTasks();
    const idx = tasks.findIndex((x) => String(x.id) === String(task.id));
    if (idx !== -1) {
      tasks[idx].text = taskText;
      if (jiraKey) {
        if (jiraData && !jiraData.error) {
          tasks[idx].jiraKey = jiraData.key;
          tasks[idx].jiraSummary = jiraData.summary;
          tasks[idx].jiraUrl = jiraData.url;
        }
      } else if (!task.jiraKey) {
        delete tasks[idx].jiraKey;
        delete tasks[idx].jiraSummary;
        delete tasks[idx].jiraUrl;
      }
      if (dueDateData) {
        tasks[idx].dueDate = dueDateData.date;
        tasks[idx].dueDateLabel = dueDateData.label;
        tasks[idx].dueDateStart = dueDateData.startDate;
        tasks[idx].dueDateType = dueDateData.type;
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
