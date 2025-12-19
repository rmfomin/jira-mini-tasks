import { el, autosizeTextarea } from '../../../common/utils/dom.js';
import { loadTasks, saveTasks } from '../../../common/storage/index.js';
import { startDrag } from '../dnd/index.js';
import { rerenderList } from './rerender.js';
import { extractJiraKey, extractDueDate, fetchJiraIssue } from '../../../common/utils/task-parsing.js';
import { updatePageMarkers } from '../../browse/markers.js';

/**
 * Рендер одного элемента списка
 */
export function renderItem(task) {
  const row = el('div', { className: 'tm-item' });
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.flexWrap = 'wrap';
  row.style.padding = '6px';
  row.style.paddingRight = '20px';
  row.style.border = '1px solid #ededed';
  row.style.borderRadius = '6px';
  row.style.position = 'relative';
  row.dataset.id = String(task.id);

  if (task.done) {
    row.style.background = '#f5f5f5';
  }

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
  text.style.fontSize = '14px';
  text.style.lineHeight = '1.4';
  text.title = 'Нажмите, чтобы редактировать';

  const deleteBtn = el('button', { type: 'button', text: '×', title: 'Удалить задачу' });
  deleteBtn.style.position = 'absolute';
  deleteBtn.style.top = '6px';
  deleteBtn.style.right = '6px';
  deleteBtn.style.width = '18px';
  deleteBtn.style.height = '18px';
  deleteBtn.style.padding = '0';
  deleteBtn.style.border = 'none';
  deleteBtn.style.borderRadius = '4px';
  deleteBtn.style.background = 'transparent';
  deleteBtn.style.color = '#9e9e9e';
  deleteBtn.style.fontSize = '18px';
  deleteBtn.style.lineHeight = '1';
  deleteBtn.style.cursor = 'pointer';
  deleteBtn.style.opacity = '0';
  deleteBtn.style.transition = 'opacity 0.2s ease, color 0.1s ease';
  deleteBtn.style.display = 'flex';
  deleteBtn.style.alignItems = 'center';
  deleteBtn.style.justifyContent = 'center';

  deleteBtn.addEventListener('mouseover', () => {
    deleteBtn.style.color = '#d32f2f';
  });
  deleteBtn.addEventListener('mouseout', () => {
    deleteBtn.style.color = '#9e9e9e';
  });

  row.appendChild(drag);
  row.appendChild(checkbox);
  row.appendChild(text);
  row.appendChild(deleteBtn);

  row.addEventListener('mouseover', () => { deleteBtn.style.opacity = '1'; });
  row.addEventListener('mouseout', () => { deleteBtn.style.opacity = '0'; });

  const linksWrap = el('div', { className: 'tm-links-wrap' });
  linksWrap.style.flexBasis = '100%';
  linksWrap.style.marginTop = '10px';
  linksWrap.style.display = 'flex';
  linksWrap.style.gap = '10px';
  linksWrap.style.flexWrap = 'wrap';
  linksWrap.style.height = '30px';

  if (task.done) {
    const doneBtnWrap = el('div', { className: 'tm-done-btn-wrap' });
    doneBtnWrap.style.position = 'relative';
    doneBtnWrap.style.display = 'inline-block';
    doneBtnWrap.style.lineHeight = '0';
    const doneBtn = el('button', { type: 'button' });
    doneBtn.style.padding = '6px 12px';
    doneBtn.style.height = '100%';
    doneBtn.style.border = '1px solid #66bb6a';
    doneBtn.style.borderRadius = '8px';
    doneBtn.style.background = '#e8f5e9';
    doneBtn.style.color = '#2e7d32';
    doneBtn.style.cursor = 'default';
    doneBtn.style.fontSize = '12px';
    doneBtn.style.fontWeight = '400';
    doneBtn.style.lineHeight = '1';
    doneBtn.style.whiteSpace = 'nowrap';
    doneBtn.style.display = 'flex';
    doneBtn.style.alignItems = 'center';
    doneBtn.style.gap = '6px';
    doneBtn.textContent = '✓ Выполнено';
    doneBtnWrap.appendChild(doneBtn);
    linksWrap.appendChild(doneBtnWrap);
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
        updatePageMarkers();
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
        updatePageMarkers();
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

  if (linksWrap.children.length > 0) {
    row.appendChild(linksWrap);
  }

  checkbox.addEventListener('change', () => {
    const tasks = loadTasks();
    const idx = tasks.findIndex((x) => String(x.id) === String(task.id));
    if (idx !== -1) {
      tasks[idx].done = !!checkbox.checked;

      // Если задача выполнена, удаляем временную метку
      if (checkbox.checked) {
        delete tasks[idx].dueDate;
        delete tasks[idx].dueDateLabel;
        delete tasks[idx].dueDateStart;
        delete tasks[idx].dueDateType;
      }

      // Сортируем: выполненные задачи в конец
      const notDone = tasks.filter((t) => !t.done);
      const done = tasks.filter((t) => t.done);
      const sortedTasks = [...notDone, ...done];

      saveTasks(sortedTasks);
      const list = row.parentElement;
      if (list) {
        rerenderList(list, sortedTasks, renderItem);
      }
      updatePageMarkers();
    }
  });

  text.addEventListener('click', () => { startEditMode(row, task); });

  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const tasks = loadTasks();
    const next = tasks.filter((x) => String(x.id) !== String(task.id));
    saveTasks(next);
    const list = row.parentElement;
    if (list) {
      rerenderList(list, next, renderItem);
    }
    updatePageMarkers();
  });

  // DnD
  drag.addEventListener('mousedown', (e) => {
    startDrag(row, e);
  });

  return row;
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
 * Переход в режим редактирования
 */
export function startEditMode(row, task) {
  // Отменяем редактирование других задач, если они есть
  const list = row.parentElement;
  if (list) {
    const editingItems = list.querySelectorAll('[data-editing="1"]');
    if (editingItems.length > 0) {
      const tasks = loadTasks();
      rerenderList(list, tasks, renderItem);
      // После перерендера находим новый row по task.id
      const newRow = list.querySelector(`[data-id="${task.id}"]`);
      if (newRow) {
        row = newRow;
      }
    }
  }

  const currentTextEl = row.querySelector('.tm-item-text');
  if (!currentTextEl) {
    return;
  }

  const input = el('textarea', { rows: '1', wrap: 'soft' });
  input.value = task.text;
  input.style.flex = '1';
  input.style.padding = '0';
  input.style.border = 'none';
  input.style.outline = 'none';
  input.style.borderRadius = '6px';
  input.style.resize = 'none';
  input.style.overflow = 'hidden';
  input.style.lineHeight = '1.4';
  input.style.fontSize = '14px';


  row.replaceChild(input, currentTextEl);
  const deleteBtn = row.querySelector('button[title="Удалить задачу"]');
  if (deleteBtn) {
    deleteBtn.style.display = 'none';
  }
  row.style.flexWrap = 'wrap';
  row.style.border = '1px solid #1976d2';
  row.dataset.editing = '1';
  const dragHandle = row.querySelector('.tm-drag');
  if (dragHandle) {
    dragHandle.style.cursor = 'not-allowed';
    dragHandle.style.opacity = '0.5';
    dragHandle.style.pointerEvents = 'none';
  }
  row.draggable = false;

  autosizeTextarea(input);

  input.focus();
  input.select();

  const handleSave = async () => {
    const val = String(input.value || '').trim();
    if (val.length === 0) {
      return;
    }
    input.disabled = true;
    row.style.border = '1px solid #1976d2';
    const jiraKey = extractJiraKey(val);
    const dueDateData = extractDueDate(val);
    let jiraData = null;
    let taskText = val;
    if (jiraKey) {
      jiraData = await fetchJiraIssue(jiraKey);
      if (jiraData.error) {
        row.style.border = '2px solid #d32f2f';
        input.disabled = false;
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
      updatePageMarkers();
    }
  };

  const handleCancel = () => {
    const list = row.parentElement;
    if (list) {
      rerenderList(list, loadTasks(), renderItem);
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  });
}
