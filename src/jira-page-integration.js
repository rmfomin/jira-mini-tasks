import { loadTasks } from './storage/index.js';
import { el } from './utils/dom.js';

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
 * Добавляет информацию о задаче из хранилища на страницу Jira
 */
function injectTaskInfo() {
  const issueKey = getIssueKeyFromUrl();
  if (!issueKey) {
    return;
  }

  const tasks = loadTasks();
  const task = tasks.find((t) => t.jiraKey === issueKey);
  if (!task) {
    return;
  }

  const pageHeader = document.querySelector('.aui-page-header');
  if (!pageHeader) {
    return;
  }

  // Проверяем, не добавлена ли уже информация
  if (document.querySelector('#tm-jira-task-info')) {
    return;
  }

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

  const titleDiv = el('div');
  titleDiv.style.fontSize = '13px';
  titleDiv.style.fontWeight = '600';
  titleDiv.style.color = '#1976d2';

  const textDiv = el('div');
  textDiv.style.fontSize = '14px';
  textDiv.style.color = '#424242';
  textDiv.style.lineHeight = '1.4';
  textDiv.style.whiteSpace = 'pre-wrap';
  textDiv.textContent = task.text || '(текст задачи отсутствует)';

  // Метка даты если есть
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

  // Вставляем после заголовка страницы
  pageHeader.parentNode.insertBefore(infoBlock, pageHeader.nextSibling);
}

/**
 * Точка входа для интеграции со страницей просмотра задачи
 */
export function initJiraPageIntegration() {
  // Пробуем сразу
  injectTaskInfo();

  // Наблюдаем за изменениями DOM (для SPA навигации)
  const observer = new MutationObserver(() => {
    injectTaskInfo();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Также перепроверяем при изменении URL
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      // Удаляем старый блок если есть
      const oldBlock = document.querySelector('#tm-jira-task-info');
      if (oldBlock) {
        oldBlock.remove();
      }
      setTimeout(injectTaskInfo, 100);
    }
  }).observe(document, { subtree: true, childList: true });
}

