import { loadTasks, saveTasks } from './storage/index.js';
import { el, autosizeTextarea } from './utils/dom.js';
import { extractJiraKey, extractDueDate, fetchJiraIssue } from './utils/task-parsing.js';

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
 * Создает форму для создания/редактирования задачи
 */
function createTaskForm(issueKey, existingTask = null) {
  const formContainer = el('div', { id: 'tm-jira-task-form' });
  formContainer.style.marginTop = '12px';
  formContainer.style.marginLeft = '20px';
  formContainer.style.marginBottom = '16px';
  formContainer.style.maxWidth = '900px';
  formContainer.style.padding = '12px 16px';
  formContainer.style.border = '1px solid #bbdefb';
  formContainer.style.borderRadius = '6px';
  formContainer.style.background = '#f5f9ff';
  formContainer.style.display = 'flex';
  formContainer.style.flexDirection = 'column';
  formContainer.style.gap = '10px';

  const titleDiv = el('div', { text: existingTask ? 'Редактировать задачу' : 'Добавить задачу' });
  titleDiv.style.fontSize = '13px';
  titleDiv.style.fontWeight = '600';
  titleDiv.style.color = '#1976d2';

  const textarea = el('textarea', {
    placeholder: 'Опишите задачу... (можно использовать @сегодня, @завтра и т.д.)',
    rows: '3',
    wrap: 'soft'
  });
  textarea.value = existingTask ? existingTask.text : '';
  textarea.style.width = '100%';
  textarea.style.padding = '8px';
  textarea.style.border = '1px solid #dcdcdc';
  textarea.style.borderRadius = '6px';
  textarea.style.fontSize = '14px';
  textarea.style.lineHeight = '1.4';
  textarea.style.resize = 'vertical';
  textarea.style.fontFamily = 'inherit';
  textarea.style.boxSizing = 'border-box';

  const buttonsDiv = el('div');
  buttonsDiv.style.display = 'flex';
  buttonsDiv.style.gap = '8px';
  buttonsDiv.style.alignItems = 'center';

  const saveBtn = el('button', { type: 'button', text: existingTask ? 'Сохранить' : 'Добавить' });
  saveBtn.style.padding = '6px 16px';
  saveBtn.style.border = '1px solid #3572b0';
  saveBtn.style.borderRadius = '6px';
  saveBtn.style.background = '#4a9ae9';
  saveBtn.style.color = '#fff';
  saveBtn.style.cursor = 'pointer';
  saveBtn.style.fontSize = '14px';
  saveBtn.style.fontWeight = '500';

  const cancelBtn = el('button', { type: 'button', text: 'Отмена' });
  cancelBtn.style.padding = '6px 16px';
  cancelBtn.style.border = '1px solid #ccc';
  cancelBtn.style.borderRadius = '6px';
  cancelBtn.style.background = '#fff';
  cancelBtn.style.color = '#666';
  cancelBtn.style.cursor = 'pointer';
  cancelBtn.style.fontSize = '14px';

  const hintDiv = el('div', { text: 'Enter — сохранить, Shift+Enter — новая строка, Esc — отмена' });
  hintDiv.style.fontSize = '12px';
  hintDiv.style.color = '#777';
  hintDiv.style.marginLeft = 'auto';

  buttonsDiv.appendChild(saveBtn);
  buttonsDiv.appendChild(cancelBtn);
  buttonsDiv.appendChild(hintDiv);

  formContainer.appendChild(titleDiv);
  formContainer.appendChild(textarea);
  formContainer.appendChild(buttonsDiv);

  autosizeTextarea(textarea);

  // Обработчик сохранения
  const handleSave = async () => {
    const val = String(textarea.value || '').trim();
    if (!val) {
      return;
    }

    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    textarea.disabled = true;
    saveBtn.textContent = '⏳';
    formContainer.style.border = '1px solid #bbdefb';

    const dueDateData = extractDueDate(val);
    let taskText = val;

    // Удаляем временную метку из текста
    if (dueDateData) {
      taskText = taskText.replace(/@[a-zа-яё]+/i, '').trim();
    }

    const tasks = loadTasks();

    if (existingTask) {
      // Редактирование существующей задачи
      const idx = tasks.findIndex((t) => String(t.id) === String(existingTask.id));
      if (idx !== -1) {
        tasks[idx].text = taskText;

        if (dueDateData) {
          tasks[idx].dueDate = dueDateData.date;
          tasks[idx].dueDateLabel = dueDateData.label;
          tasks[idx].dueDateStart = dueDateData.startDate;
          tasks[idx].dueDateType = dueDateData.type;
        }

        saveTasks(tasks);
      }
    } else {
      // Создание новой задачи
      const jiraSummary = document.querySelector('#summary-val')?.textContent || '';
      const newTask = {
        id: Date.now(),
        text: taskText,
        done: false,
        createdAt: Date.now(),
        jiraKey: issueKey,
        jiraSummary: jiraSummary,
        jiraUrl: `https://jira.theteamsoft.com/browse/${issueKey}`,
      };

      if (dueDateData) {
        newTask.dueDate = dueDateData.date;
        newTask.dueDateLabel = dueDateData.label;
        newTask.dueDateStart = dueDateData.startDate;
        newTask.dueDateType = dueDateData.type;
      }

      tasks.unshift(newTask);
      saveTasks(tasks);
    }

    // Перерисовываем
    refreshTaskDisplay();
  };

  // Обработчик отмены
  const handleCancel = () => {
    refreshTaskDisplay();
  };

  saveBtn.addEventListener('click', handleSave);
  cancelBtn.addEventListener('click', handleCancel);

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  });

  return formContainer;
}

/**
 * Создает отображение задачи с возможностью редактирования
 */
function createTaskDisplay(task) {
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

  // Эффект при наведении
  infoBlock.addEventListener('mouseenter', () => {
    infoBlock.style.background = '#e3f2fd';
    infoBlock.style.borderColor = '#90caf9';
  });

  infoBlock.addEventListener('mouseleave', () => {
    infoBlock.style.background = '#f5f9ff';
    infoBlock.style.borderColor = '#e3f2fd';
  });

  // Клик для редактирования
  infoBlock.addEventListener('click', () => {
    const issueKey = getIssueKeyFromUrl();
    if (issueKey) {
      showTaskForm(issueKey, task);
    }
  });

  return infoBlock;
}

/**
 * Создает кнопку "Добавить задачу"
 */
function createAddTaskButton(issueKey) {
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
    showTaskForm(issueKey);
  });

  return button;
}

/**
 * Показывает форму создания/редактирования
 */
function showTaskForm(issueKey, existingTask = null) {
  // Удаляем текущее отображение
  const oldBlock = document.querySelector('#tm-jira-task-info');
  const oldForm = document.querySelector('#tm-jira-task-form');
  const oldButton = document.querySelector('#tm-jira-add-task');

  if (oldBlock) oldBlock.remove();
  if (oldForm) oldForm.remove();
  if (oldButton) oldButton.remove();

  // Создаем форму
  const form = createTaskForm(issueKey, existingTask);

  const stalker = document.querySelector('#stalker');
  const pageHeader = stalker ? stalker.querySelector('.aui-page-header') : document.querySelector('.aui-page-header');
  if (pageHeader && pageHeader.parentNode) {
    pageHeader.parentNode.insertBefore(form, pageHeader.nextSibling);

    // Фокусируемся на textarea
    const textarea = form.querySelector('textarea');
    if (textarea) {
      setTimeout(() => {
        textarea.focus();
        if (existingTask) {
          textarea.select();
        }
      }, 100);
    }
  }
}

/**
 * Обновляет отображение задачи на странице
 */
function refreshTaskDisplay() {
  const issueKey = getIssueKeyFromUrl();
  if (!issueKey) {
    return;
  }

  // Удаляем старые элементы
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
    // Показываем задачу
    const display = createTaskDisplay(task);
    pageHeader.parentNode.insertBefore(display, pageHeader.nextSibling);
  } else {
    // Показываем кнопку добавления
    const button = createAddTaskButton(issueKey);
    pageHeader.parentNode.insertBefore(button, pageHeader.nextSibling);
  }
}

/**
 * Добавляет информацию о задаче из хранилища на страницу Jira
 */
function injectTaskInfo() {
  const issueKey = getIssueKeyFromUrl();
  if (!issueKey) {
    return;
  }

  const stalker = document.querySelector('#stalker');
  const pageHeader = stalker ? stalker.querySelector('.aui-page-header') : document.querySelector('.aui-page-header');
  if (!pageHeader) {
    return;
  }

  // Проверяем, не добавлена ли уже информация
  if (document.querySelector('#tm-jira-task-info') ||
      document.querySelector('#tm-jira-task-form') ||
      document.querySelector('#tm-jira-add-task')) {
    return;
  }

  refreshTaskDisplay();
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
      // Удаляем старые блоки если есть
      const oldBlock = document.querySelector('#tm-jira-task-info');
      const oldForm = document.querySelector('#tm-jira-task-form');
      const oldButton = document.querySelector('#tm-jira-add-task');

      if (oldBlock) oldBlock.remove();
      if (oldForm) oldForm.remove();
      if (oldButton) oldButton.remove();

      setTimeout(injectTaskInfo, 100);
    }
  }).observe(document, { subtree: true, childList: true });
}

