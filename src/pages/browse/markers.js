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

  if (element.tagName === 'TR') {
    const summaryCell = element.querySelector('td.summary');
    if (summaryCell) {
      targetElement = summaryCell;
    }
  }

  const computedPosition = window.getComputedStyle(targetElement).position;
  if (computedPosition === 'static') {
    targetElement.style.position = 'relative';
  }

  const indicator = document.createElement('span');
  indicator.className = TODO_INDICATOR_CLASS;
  indicator.textContent = '📌 todo';
  indicator.style.position = 'absolute';
  indicator.style.top = '50%';
  indicator.style.right = '0';
  indicator.style.transform = 'translateY(-50%)';
  indicator.style.fontSize = '11px';
  indicator.style.opacity = '0.5';
  indicator.style.fontWeight = 'normal';
  indicator.style.color = '#666';
  indicator.style.background = '#fff3cd';
  indicator.style.padding = '2px 6px';
  indicator.style.borderRadius = '4px';
  indicator.style.border = '1px solid #ffc107';
  indicator.style.whiteSpace = 'nowrap';
  indicator.style.transition = 'opacity 0.2s ease';
  indicator.style.zIndex = '100';
  indicator.style.pointerEvents = 'none';

  targetElement.addEventListener('mouseenter', () => {
    indicator.style.opacity = '1';
  });

  targetElement.addEventListener('mouseleave', () => {
    indicator.style.opacity = '0.5';
  });

  targetElement.appendChild(indicator);
  element.setAttribute(TODO_INDICATOR_ATTR, 'true');
}

/**
 * Удаление индикатора у элемента
 */
function removeTodoIndicator(element) {
  if (!element.hasAttribute(TODO_INDICATOR_ATTR)) {
    return;
  }

  let targetElement = element;

  if (element.tagName === 'TR') {
    const summaryCell = element.querySelector('td.summary');
    if (summaryCell) {
      targetElement = summaryCell;
    }
  }

  const indicator = targetElement.querySelector(`.${TODO_INDICATOR_CLASS}`);
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

