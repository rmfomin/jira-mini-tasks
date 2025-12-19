import { loadTasks, saveTasks } from '../../common/storage/index.js';
import { el, autosizeTextarea } from '../../common/utils/dom.js';
import { extractDueDate } from '../../common/utils/task-parsing.js';

/**
 * Извлекает issue key из URL
 */
function getIssueKeyFromUrl() {
  const match = window.location.pathname.match(/\/browse\/([A-Z]+-\d+)/);
  return match ? match[1] : null;
}

/**
 * Создает форму для создания/редактирования задачи
 */
export function createTaskForm(issueKey, existingTask = null, onSave, onCancel) {
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

    if (dueDateData) {
      taskText = taskText.replace(/@[a-zа-яё]+/i, '').trim();
    }

    const tasks = loadTasks();

    if (existingTask) {
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

    if (onSave) {
      onSave();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
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
 * Показывает форму создания/редактирования
 */
export function showTaskForm(issueKey, existingTask = null, onComplete) {
  const oldBlock = document.querySelector('#tm-jira-task-info');
  const oldForm = document.querySelector('#tm-jira-task-form');
  const oldButton = document.querySelector('#tm-jira-add-task');

  if (oldBlock) oldBlock.remove();
  if (oldForm) oldForm.remove();
  if (oldButton) oldButton.remove();

  const form = createTaskForm(issueKey, existingTask, onComplete, onComplete);

  const stalker = document.querySelector('#stalker');
  const pageHeader = stalker ? stalker.querySelector('.aui-page-header') : document.querySelector('.aui-page-header');
  if (pageHeader && pageHeader.parentNode) {
    pageHeader.parentNode.insertBefore(form, pageHeader.nextSibling);

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

