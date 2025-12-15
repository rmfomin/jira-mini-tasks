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

  if (task.jiraKey && task.jiraSummary) {
    const jiraView = el('div', { className: 'tm-jira-link-wrap' });
    jiraView.style.flexBasis = '100%';
    jiraView.style.marginTop = '4px';
    jiraView.style.overflow = 'hidden';
    const truncatedSummary = task.jiraSummary.length > 25 ? task.jiraSummary.substring(0, 25) + '…' : task.jiraSummary;
    const jiraBtn = el('button', { type: 'button', title: task.jiraSummary });
    jiraBtn.style.padding = '6px 12px';
    jiraBtn.style.border = '1px solid #d0d0d0';
    jiraBtn.style.borderRadius = '8px';
    jiraBtn.style.background = '#f5f5f5';
    jiraBtn.style.color = '#424242';
    jiraBtn.style.cursor = 'pointer';
    jiraBtn.style.fontSize = '13px';
    jiraBtn.style.fontWeight = '400';
    jiraBtn.style.maxWidth = '100%';
    jiraBtn.style.whiteSpace = 'nowrap';
    jiraBtn.style.overflow = 'hidden';
    jiraBtn.style.textOverflow = 'ellipsis';
    jiraBtn.style.transition = 'background 0.2s ease';
    jiraBtn.style.textAlign = 'left';
    jiraBtn.style.display = 'flex';
    jiraBtn.style.alignItems = 'center';
    jiraBtn.style.gap = '6px';
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
    jiraBtn.appendChild(jiraIcon);
    jiraBtn.appendChild(textSpan);
    jiraBtn.addEventListener('mouseover', () => { jiraBtn.style.background = '#e8e8e8'; });
    jiraBtn.addEventListener('mouseout', () => { jiraBtn.style.background = '#f5f5f5'; });
    jiraBtn.addEventListener('click', () => {
      window.open(task.jiraUrl || `https://jira.theteamsoft.com/browse/${task.jiraKey}`, '_blank', 'noopener,noreferrer');
    });
    jiraView.appendChild(jiraBtn);
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
      taskText = val.replace(/\b[A-Z]+-\d+\b/, '').trim();
    }
    const tasks = loadTasks();
    const idx = tasks.findIndex((x) => String(x.id) === String(task.id));
    if (idx !== -1) {
      tasks[idx].text = taskText;
      if (jiraData && !jiraData.error) {
        tasks[idx].jiraKey = jiraData.key;
        tasks[idx].jiraSummary = jiraData.summary;
        tasks[idx].jiraUrl = jiraData.url;
      } else {
        delete tasks[idx].jiraKey;
        delete tasks[idx].jiraSummary;
        delete tasks[idx].jiraUrl;
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
