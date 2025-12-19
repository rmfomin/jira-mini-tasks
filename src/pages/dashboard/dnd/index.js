import { loadTasks, saveTasks } from '../../../common/storage/index.js';
import { updatePageMarkers } from '../../browse/markers.js';

let dragState = {
  isDragging: false,
  draggedElement: null,
  ghostElement: null,
  dropIndicator: null,
  startX: 0,
  startY: 0,
  offsetX: 0,
  offsetY: 0,
  initialParent: null,
  initialNextSibling: null,
};

/**
 * Сохраняет порядок задач по текущему DOM и возвращает новый массив задач
 */
export function persistOrderFromDom(listEl) {
  const ids = Array.from(listEl.children)
    .map((n) => n.dataset && n.dataset.id)
    .filter(Boolean);
  const tasks = loadTasks();
  const map = new Map(tasks.map((t) => [String(t.id), t]));
  const next = ids
    .map((id) => map.get(String(id)))
    .filter(Boolean);
  if (next.length === tasks.length) {
    saveTasks(next);
    return next;
  }
  return tasks;
}

/**
 * Создает индикатор-линию для drop-зоны
 */
function createDropIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'tm-drop-indicator';
  indicator.style.height = '3px';
  indicator.style.background = '#4a9ae9';
  indicator.style.borderRadius = '2px';
  indicator.style.margin = '2px 0';
  indicator.style.boxShadow = '0 0 4px rgba(74, 154, 233, 0.6)';
  indicator.style.pointerEvents = 'none';
  return indicator;
}

/**
 * Находит элемент задачи под курсором и определяет позицию вставки
 */
function findDropTarget(clientY, listEl) {
  const items = Array.from(listEl.children).filter(
    (el) => el.classList.contains('tm-item') && el !== dragState.draggedElement
  );

  if (items.length === 0) {
    return { element: null, insertBefore: true };
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rect = item.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;

    if (clientY < midpoint) {
      return { element: item, insertBefore: true };
    }

    if (i === items.length - 1 && clientY >= midpoint) {
      return { element: item, insertBefore: false };
    }
  }

  return { element: items[items.length - 1], insertBefore: false };
}

/**
 * Обновляет позицию индикатора вставки
 */
function updateDropIndicator(clientY, listEl) {
  if (!dragState.dropIndicator || !listEl) {
    return;
  }

  const target = findDropTarget(clientY, listEl);

  if (!target.element) {
    if (listEl.children.length === 0 || (listEl.children.length === 1 && listEl.children[0] === dragState.draggedElement)) {
      if (!dragState.dropIndicator.parentElement) {
        listEl.appendChild(dragState.dropIndicator);
      }
    }
    return;
  }

  if (target.insertBefore) {
    listEl.insertBefore(dragState.dropIndicator, target.element);
  } else {
    if (target.element.nextSibling) {
      listEl.insertBefore(dragState.dropIndicator, target.element.nextSibling);
    } else {
      listEl.appendChild(dragState.dropIndicator);
    }
  }
}

/**
 * Начинает перетаскивание элемента
 */
export function startDrag(element, event) {
  if (element.dataset && element.dataset.editing === '1') {
    return;
  }

  const listEl = element.parentElement;
  if (!listEl) {
    return;
  }

  event.preventDefault();

  dragState.isDragging = true;
  dragState.draggedElement = element;
  dragState.initialParent = listEl;
  dragState.initialNextSibling = element.nextSibling;

  const rect = element.getBoundingClientRect();
  dragState.startX = event.clientX;
  dragState.startY = event.clientY;
  dragState.offsetX = event.clientX - rect.left;
  dragState.offsetY = event.clientY - rect.top;

  const ghost = element.cloneNode(true);
  ghost.className = 'tm-item-ghost';
  ghost.style.position = 'fixed';
  ghost.style.left = rect.left + 'px';
  ghost.style.top = rect.top + 'px';
  ghost.style.width = rect.width + 'px';
  ghost.style.opacity = '0.8';
  ghost.style.pointerEvents = 'none';
  ghost.style.zIndex = '10000';
  ghost.style.transition = 'none';
  ghost.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  document.body.appendChild(ghost);
  dragState.ghostElement = ghost;

  element.style.opacity = '0.3';

  dragState.dropIndicator = createDropIndicator();

  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('mouseup', handleDragEnd);
}

/**
 * Обрабатывает движение мыши при перетаскивании
 */
function handleDragMove(event) {
  if (!dragState.isDragging || !dragState.ghostElement || !dragState.draggedElement) {
    return;
  }

  const x = event.clientX - dragState.offsetX;
  const y = event.clientY - dragState.offsetY;

  dragState.ghostElement.style.left = x + 'px';
  dragState.ghostElement.style.top = y + 'px';

  const listEl = dragState.initialParent;
  if (listEl) {
    updateDropIndicator(event.clientY, listEl);
  }
}

/**
 * Завершает перетаскивание элемента
 */
function handleDragEnd(event) {
  if (!dragState.isDragging) {
    return;
  }

  document.removeEventListener('mousemove', handleDragMove);
  document.removeEventListener('mouseup', handleDragEnd);

  if (dragState.ghostElement) {
    dragState.ghostElement.remove();
  }

  if (dragState.draggedElement) {
    dragState.draggedElement.style.opacity = '1';
  }

  const listEl = dragState.initialParent;

  if (dragState.dropIndicator && dragState.dropIndicator.parentElement && dragState.draggedElement) {
    const indicator = dragState.dropIndicator;
    const parent = indicator.parentElement;

    if (parent === listEl) {
      parent.insertBefore(dragState.draggedElement, indicator);
      indicator.remove();

      const updatedTasks = persistOrderFromDom(listEl);

      // Деактивируем кнопку сортировки после перемещения
      if (window.__tmDeactivateSortButton) {
        window.__tmDeactivateSortButton();
      }

      const rerenderModule = window.__tmRerenderList;
      const renderItemModule = window.__tmRenderItem;
      if (rerenderModule && renderItemModule) {
        rerenderModule(listEl, updatedTasks, renderItemModule);
      }

      updatePageMarkers();
    } else {
      indicator.remove();
      if (dragState.initialNextSibling) {
        listEl.insertBefore(dragState.draggedElement, dragState.initialNextSibling);
      } else {
        listEl.appendChild(dragState.draggedElement);
      }
    }
  } else {
    if (dragState.dropIndicator && dragState.dropIndicator.parentElement) {
      dragState.dropIndicator.remove();
    }

    if (dragState.initialNextSibling) {
      listEl.insertBefore(dragState.draggedElement, dragState.initialNextSibling);
    } else {
      listEl.appendChild(dragState.draggedElement);
    }
  }

  dragState = {
    isDragging: false,
    draggedElement: null,
    ghostElement: null,
    dropIndicator: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    initialParent: null,
    initialNextSibling: null,
  };
}

