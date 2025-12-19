import { loadTasks } from '../../common/storage/index.js';

const TODO_INDICATOR_CLASS = 'tm-jira-todo-indicator';
const TODO_INDICATOR_ATTR = 'data-tm-todo-marked';

/**
 * Добавление индикатора к элементу
 */
function addTodoIndicator(element) {
  if (element.hasAttribute(TODO_INDICATOR_ATTR)) {
    return;
  }

  let targetElement = element;
  let insertMode = 'append';

  if (element.tagName === 'TR') {
    const summaryCell = element.querySelector('td.summary');
    if (summaryCell) {
      const paragraph = summaryCell.querySelector('p');
      const issueLink = paragraph ? paragraph.querySelector('a.issue-link') : null;

      if (issueLink && paragraph) {
        targetElement = paragraph;
        insertMode = 'afterLink';
      } else {
        targetElement = summaryCell;
      }
    }
  }

  const indicator = document.createElement('span');
  indicator.className = TODO_INDICATOR_CLASS;
  indicator.textContent = '🚩 todo';
  indicator.style.fontSize = '14px';
  indicator.style.opacity = '0.7';
  indicator.style.fontWeight = 'normal';
  indicator.style.color = '#000000';
  indicator.style.background = '#f3f3f3';
  indicator.style.padding = '2px 6px';
  indicator.style.borderRadius = '4px';
  indicator.style.border = '1px solid #a2a2a2';
  indicator.style.whiteSpace = 'nowrap';
  indicator.style.transition = 'opacity 0.2s ease';
  indicator.style.marginLeft = '8px';
  indicator.style.display = 'inline-block';
  indicator.style.verticalAlign = 'middle';

  if (insertMode === 'afterLink') {
    const issueLink = targetElement.querySelector('a.issue-link');
    if (issueLink && issueLink.nextSibling) {
      targetElement.insertBefore(indicator, issueLink.nextSibling);
    } else if (issueLink) {
      targetElement.appendChild(indicator);
    } else {
      targetElement.appendChild(indicator);
    }
  } else {
    targetElement.appendChild(indicator);
  }

  element.setAttribute(TODO_INDICATOR_ATTR, 'true');
}

/**
 * Удаление индикатора у элемента
 */
function removeTodoIndicator(element) {
  if (!element.hasAttribute(TODO_INDICATOR_ATTR)) {
    return;
  }

  const indicator = element.querySelector(`.${TODO_INDICATOR_CLASS}`);
  if (indicator) {
    indicator.remove();
  }
  element.removeAttribute(TODO_INDICATOR_ATTR);
}

/**
 * Обновление маркировки всех элементов на странице
 */
export function updatePageMarkers() {
  const tasks = loadTasks();
  const jiraKeysInTodo = new Set();

  tasks.forEach((task) => {
    if (task.jiraKey) {
      jiraKeysInTodo.add(task.jiraKey.toUpperCase());
    }
  });

  const elementsWithIssueKey = document.querySelectorAll('[data-issuekey]');

  elementsWithIssueKey.forEach((element) => {
    const issueKey = element.getAttribute('data-issuekey');
    if (!issueKey) {
      return;
    }

    const normalizedKey = issueKey.toUpperCase();

    if (jiraKeysInTodo.has(normalizedKey)) {
      addTodoIndicator(element);
    } else {
      removeTodoIndicator(element);
    }
  });
}

/**
 * Запуск наблюдателя за маркировкой элементов
 */
export function startPageMarkerObserver() {
  const observer = new MutationObserver((mutations) => {
    let needsUpdate = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            if (element.hasAttribute && element.hasAttribute('data-issuekey')) {
              needsUpdate = true;
            }
            if (element.querySelectorAll) {
              const nested = element.querySelectorAll('[data-issuekey]');
              if (nested.length > 0) {
                needsUpdate = true;
              }
            }
          }
        });
      } else if (mutation.type === 'attributes' && mutation.attributeName === 'data-issuekey') {
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      updatePageMarkers();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-issuekey'],
  });

  updatePageMarkers();

  return observer;
}

