import { loadTasks } from '../../common/storage/index.js';
import { el } from '../../common/utils/dom.js';
import { showTaskForm } from './task-form.js';

/**
 * Извлекает issue key из URL
 */
function getIssueKeyFromUrl() {
  const match = window.location.pathname.match(/\/browse\/([A-Z]+-\d+)/);
  return match ? match[1] : null;
}

/**
 * Форматирует дату создания задачи
 */
function formatCreatedDate(timestamp) {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Форматирует дату для отображения
 */
function formatDateDisplay(dateStr) {
  const date = new Date(dateStr);
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

/**
 * Проверяет, просрочена ли дата
 */
function isOverdue(dateStr) {
  const now = new Date();
  const due = new Date(dateStr);
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < now;
}

/**
 * Создает отображение задачи с возможностью редактирования
 */
function createTaskDisplay(task, onEdit) {
  const infoBlock = el('div', { id: 'tm-jira-task-info' });
  infoBlock.style.marginTop = '12px';
  infoBlock.style.marginLeft = '20px';
  infoBlock.style.marginBottom = '16px';
  infoBlock.style.maxWidth = '900px';
  infoBlock.style.padding = '12px 16px';
  infoBlock.style.border = '1px solid #e3f2fd';
  infoBlock.style.borderRadius = '6px';
  infoBlock.style.background = '#f5f9ff';
  infoBlock.style.display = 'flex';
  infoBlock.style.flexDirection = 'column';
  infoBlock.style.gap = '6px';
  infoBlock.style.cursor = 'pointer';
  infoBlock.style.transition = 'background 0.2s ease, border-color 0.2s ease';
  infoBlock.title = 'Нажмите, чтобы редактировать';

  const titleDiv = el('div', { text: 'Задача' });
  titleDiv.style.fontSize = '13px';
  titleDiv.style.fontWeight = '600';
  titleDiv.style.color = '#1976d2';

  const textDiv = el('div');
  textDiv.style.fontSize = '14px';
  textDiv.style.color = '#424242';
  textDiv.style.lineHeight = '1.4';
  textDiv.style.whiteSpace = 'pre-wrap';
  textDiv.textContent = task.text || '(текст задачи отсутствует)';

  let dueDateDiv = null;
  if (task.dueDateLabel && task.dueDate) {
    const overdue = isOverdue(task.dueDate);
    const dateText = overdue ? formatDateDisplay(task.dueDate) : task.dueDateLabel;
    dueDateDiv = el('div');
    dueDateDiv.style.fontSize = '12px';
    dueDateDiv.style.color = overdue ? '#c62828' : '#1976d2';
    dueDateDiv.style.fontWeight = '500';
    dueDateDiv.textContent = `＠ ${dateText}`;
  }

  const timeDiv = el('div');
  timeDiv.style.fontSize = '12px';
  timeDiv.style.color = '#777';
  timeDiv.textContent = `Добавлено: ${formatCreatedDate(task.createdAt)}`;

  infoBlock.appendChild(titleDiv);
  infoBlock.appendChild(textDiv);
  if (dueDateDiv) {
    infoBlock.appendChild(dueDateDiv);
  }
  infoBlock.appendChild(timeDiv);

  infoBlock.addEventListener('mouseenter', () => {
    infoBlock.style.background = '#e3f2fd';
    infoBlock.style.borderColor = '#90caf9';
  });

  infoBlock.addEventListener('mouseleave', () => {
    infoBlock.style.background = '#f5f9ff';
    infoBlock.style.borderColor = '#e3f2fd';
  });

  infoBlock.addEventListener('click', () => {
    if (onEdit) {
      onEdit(task);
    }
  });

  return infoBlock;
}

/**
 * Создает кнопку "Добавить задачу"
 */
function createAddTaskButton(issueKey, onAdd) {
  const button = el('button', { type: 'button', text: '+ Добавить задачу', id: 'tm-jira-add-task' });
  button.style.marginTop = '12px';
  button.style.marginLeft = '20px';
  button.style.marginBottom = '16px';
  button.style.padding = '10px 16px';
  button.style.border = '1px solid #3572b0';
  button.style.borderRadius = '6px';
  button.style.background = '#4a9ae9';
  button.style.color = '#fff';
  button.style.cursor = 'pointer';
  button.style.fontSize = '14px';
  button.style.fontWeight = '500';
  button.style.transition = 'background 0.2s ease';

  button.addEventListener('mouseenter', () => {
    button.style.background = '#357abd';
  });

  button.addEventListener('mouseleave', () => {
    button.style.background = '#4a9ae9';
  });

  button.addEventListener('click', () => {
    if (onAdd) {
      onAdd();
    }
  });

  return button;
}

/**
 * Обновляет отображение задачи на странице
 */
export function refreshTaskDisplay() {
  const issueKey = getIssueKeyFromUrl();
  if (!issueKey) {
    return;
  }

  const oldBlock = document.querySelector('#tm-jira-task-info');
  const oldForm = document.querySelector('#tm-jira-task-form');
  const oldButton = document.querySelector('#tm-jira-add-task');

  if (oldBlock) oldBlock.remove();
  if (oldForm) oldForm.remove();
  if (oldButton) oldButton.remove();

  const tasks = loadTasks();
  const task = tasks.find((t) => t.jiraKey === issueKey);

  const stalker = document.querySelector('#stalker');
  const pageHeader = stalker ? stalker.querySelector('.aui-page-header') : document.querySelector('.aui-page-header');
  if (!pageHeader || !pageHeader.parentNode) {
    return;
  }

  if (task) {
    const display = createTaskDisplay(task, (taskToEdit) => {
      showTaskForm(issueKey, taskToEdit, refreshTaskDisplay);
    });
    pageHeader.parentNode.insertBefore(display, pageHeader.nextSibling);
  } else {
    const button = createAddTaskButton(issueKey, () => {
      showTaskForm(issueKey, null, refreshTaskDisplay);
    });
    pageHeader.parentNode.insertBefore(button, pageHeader.nextSibling);
  }
}

