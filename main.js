// ==UserScript==
// @name         Jira Mini Tasks
// @description  Adds personal To-Do list linked to JIRA issues
// @namespace    http://tampermonkey.net/
// @version      0.3.0
// @author       rs.fomin@rbspayment.ru
// @match        https://jira.theteamsoft.com/secure/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
  'use strict';

  /** *******************************
   * Настройки
   **********************************/
  const numberId = '20269';

  /** *******************************
   * Константы
   **********************************/
  const GADGET_ID = `gadget-${numberId}-chrome`;
  const HEADER_SELECTOR = `#gadget-${numberId}-title`;
  const CONTENT_SELECTOR = '.dashboard-item-content';
  const WRAPPER_ID = 'tm-smart-tasks';
  const INIT_POLL_MS = 800;
  const INIT_POLL_MAX_TRIES = 60;
  const STORAGE_KEY = 'tmSmartTasks.items';

  /** *********************************************
   * Глобальный обработчик закрытия меню
   * Описание: скрывает открытые меню по клику вне элемента.
   **********************************************/
  let globalMenuCloserAttached = false;
  function setupGlobalMenuCloser() {
    if (globalMenuCloserAttached) {
      return;
    }
    document.addEventListener('click', (ev) => {
      const target = ev.target;
      if (!(target instanceof Node)) {
        return;
      }
      const wraps = document.querySelectorAll('.tm-menu-wrap');
      wraps.forEach((wrap) => {
        if (!wrap.contains(target)) {
          const menu = wrap.querySelector('.tm-item-menu');
          if (menu) {
            menu.style.display = 'none';
          }
        }
      });
    });
    globalMenuCloserAttached = true;
  }

  /** *********************************************
   * Drag & Drop — глобальное состояние
   * Описание: текущий перетаскиваемый элемент и пересчет порядка.
   **********************************************/
  let draggingId = null;

  function persistOrderFromDom(listEl) {
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
      rerenderList(listEl, next);
    }
  }

  /** **************************************
   * Хранилище задач
   * Описание: загрузка и сохранение списка задач.
   *****************************************/
  function loadTasks() {
    try {
      const raw = GM_getValue(STORAGE_KEY, '[]');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  function saveTasks(tasks) {
    try {
      GM_setValue(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
    }
  }

  /** *********************************************
   * Поиск целевого гаджета на дашборде
   * Описание: периодический опрос до появления контейнера.
   **********************************************/
  function pollForGadget(onFound) {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const gadgetEl = document.getElementById(GADGET_ID);
      if (gadgetEl) {
        clearInterval(timer);
        onFound(gadgetEl);
      } else if (tries >= INIT_POLL_MAX_TRIES) {
        clearInterval(timer);
      }
    }, INIT_POLL_MS);

    return () => {
      clearInterval(timer);
    };
  }

  /** *********************************************
   * Утилита очистки DOM-элемента
   * Описание: удаление всех дочерних узлов.
   **********************************************/
  function empty(el) {
    if (!el) {
      return;
    }
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  /** *********************************************
   * Создание элемента с атрибутами
   * Описание: упрощает создание DOM-узлов.
   **********************************************/
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') {
        node.className = v;
      } else if (k === 'text') {
        node.textContent = v;
      } else if (k === 'html') {
        node.innerHTML = v;
      } else {
        node.setAttribute(k, v);
      }
    });
    children.forEach((c) => {
      if (typeof c === 'string') {
        node.appendChild(document.createTextNode(c));
      } else if (c instanceof Node) {
        node.appendChild(c);
      }
    });
    return node;
  }

  /** *********************************************
   * Рендер UI todo-листа
   * Описание: строит форму добавления и список задач.
   **********************************************/
  function renderUI(root, initialTasks) {
    empty(root);
    const form = el('div', { className: 'tm-form' });
    form.style.display = 'flex';
    form.style.gap = '8px';
    form.style.marginBottom = '10px';

    const input = el('input', { type: 'text', placeholder: 'Новая задача…', id: 'tm-input' });
    input.style.flex = '1';
    input.style.padding = '6px 8px';
    input.style.border = '1px solid #dcdcdc';
    input.style.borderRadius = '6px';

    const addBtn = el('button', { type: 'button', id: 'tm-add-btn', text: 'Добавить' });
    addBtn.style.padding = '6px 10px';
    addBtn.style.border = '1px solid #3572b0';
    addBtn.style.borderRadius = '6px';
    addBtn.style.background = '#4a9ae9';
    addBtn.style.color = '#fff';
    addBtn.style.cursor = 'pointer';

    form.appendChild(input);
    form.appendChild(addBtn);

    const list = el('div', { id: 'tm-list' });
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '6px';

    initialTasks.forEach((t) => {
      list.appendChild(renderItem(t));
    });

    root.appendChild(form);
    root.appendChild(list);

    addBtn.addEventListener('click', () => {
      const val = String(input.value || '').trim();
      if (val.length === 0) {
        return;
      }
      const current = loadTasks();
      const next = [
        ...current,
        {
          id: Date.now(),
          text: val,
          done: false,
          createdAt: Date.now(),
        },
      ];
      saveTasks(next);
      input.value = '';
      rerenderList(list, next);
      input.focus();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        addBtn.click();
      }
    });
  }

  /** *********************************************
   * Рендер одного элемента списка
   * Описание: создаёт DOM-узел задачи с чекбоксом и редактированием текста.
   **********************************************/
  function renderItem(task) {
    const row = el('div', { className: 'tm-item' });
    row.style.display = 'flex';
    row.style.alignItems = 'center';
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
    text.style.cursor = 'text';
    text.title = 'Нажмите, чтобы редактировать';
    if (task.done) {
      text.style.textDecoration = 'line-through';
      text.style.opacity = '0.7';
    }

    // Кнопка редактирования убрана — редактирование открывается по клику на текст

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

    const deleteItem = el('button', { type: 'button', text: '🗑\u2002Удалить' });
    deleteItem.style.display = 'block';
    deleteItem.style.width = '100%';
    deleteItem.style.textAlign = 'left';
    deleteItem.style.padding = '6px 8px';
    deleteItem.style.border = '1px solid transparent';
    deleteItem.style.borderRadius = '4px';
    deleteItem.style.background = '#fff';
    deleteItem.style.cursor = 'pointer';
    deleteItem.style.whiteSpace = 'nowrap';

    deleteItem.addEventListener('mouseover', () => {
      deleteItem.style.background = '#f6f6f6';
    });
    deleteItem.addEventListener('mouseout', () => {
      deleteItem.style.background = '#fff';
    });

    row.appendChild(drag);
    row.appendChild(checkbox);
    row.appendChild(text);
    // Кнопка редактирования не добавляется
    menu.appendChild(deleteItem);
    menuWrap.appendChild(menuBtn);
    menuWrap.appendChild(menu);
    row.appendChild(menuWrap);

    checkbox.addEventListener('change', () => {
      const tasks = loadTasks();
      const idx = tasks.findIndex((x) => String(x.id) === String(task.id));
      if (idx !== -1) {
        tasks[idx].done = !!checkbox.checked;
        saveTasks(tasks);
        const list = row.parentElement;
        if (list) {
          rerenderList(list, tasks);
        }
      }
    });

    // Открываем редактирование кликом по тексту задачи
    text.addEventListener('click', () => {
      startEditMode(row, task);
    });

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
        rerenderList(list, next);
      }
    });

    // DnD — разрешаем перетаскивание только за ручку
    drag.addEventListener('mousedown', () => {
      row.draggable = true;
    });
    row.addEventListener('dragstart', (e) => {
      if (!row.draggable) {
        e.preventDefault();
        return;
      }
      draggingId = row.dataset.id || null;
      row.style.opacity = '0.6';
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        try {
          e.dataTransfer.setData('text/plain', draggingId || '');
        } catch (err) {
        }
      }
    });
    row.addEventListener('dragend', () => {
      row.style.opacity = '1';
      row.draggable = false;
      draggingId = null;
    });
    row.addEventListener('dragover', (e) => {
      if (!draggingId) {
        return;
      }
      e.preventDefault();
      const list = row.parentElement;
      if (!list || !(list instanceof Node)) {
        return;
      }
      const draggingEl = Array.from(list.children).find((n) => n.dataset && n.dataset.id === draggingId);
      if (!draggingEl || draggingEl === row) {
        return;
      }
      const rect = row.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      if (before) {
        list.insertBefore(draggingEl, row);
      } else {
        list.insertBefore(draggingEl, row.nextSibling);
      }
    });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      const list = row.parentElement;
      if (list) {
        persistOrderFromDom(list);
      }
    });

    return row;
  }

  /** *********************************************
   * Переход элемента в режим редактирования
   * Описание: заменяет текст на input и показывает кнопки Сохранить/Отмена.
   **********************************************/
  function startEditMode(row, task) {
    const currentTextEl = row.querySelector('.tm-item-text');
    if (!currentTextEl) {
      return;
    }

    const input = el('input', { type: 'text' });
    input.value = task.text;
    input.style.flex = '1';
    input.style.padding = '4px 6px';
    input.style.border = '1px solid #dcdcdc';
    input.style.borderRadius = '6px';

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
    // Кнопка редактирования удалена из разметки — ничего убирать не нужно
    const oldMenuWrap = row.querySelector('.tm-menu-wrap');
    if (oldMenuWrap) {
      row.removeChild(oldMenuWrap);
    }
    // В режиме редактирования переносим действия под строку
    row.style.flexWrap = 'wrap';
    row.appendChild(cancelBtn);

    const actions = el('div', { className: 'tm-edit-actions' });
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.marginTop = '6px';
    actions.style.flexBasis = '100%';

    actions.appendChild(saveBtn);
    row.appendChild(actions);

    input.focus();
    input.select();

    saveBtn.addEventListener('click', () => {
      const val = String(input.value || '').trim();
      if (val.length === 0) {
        return;
      }
      const tasks = loadTasks();
      const idx = tasks.findIndex((x) => String(x.id) === String(task.id));
      if (idx !== -1) {
        tasks[idx].text = val;
        saveTasks(tasks);
        const list = row.parentElement;
        if (list) {
          rerenderList(list, tasks);
        }
      }
    });

    cancelBtn.addEventListener('click', () => {
      const list = row.parentElement;
      if (list) {
        rerenderList(list, loadTasks());
      }
    });

    // Кнопка удаления в режиме редактирования удалена по требованию

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveBtn.click();
      } else if (e.key === 'Escape') {
        cancelBtn.click();
      }
    });
  }

  /** *********************************************
   * Перерисовка списка задач
   * Описание: заменяет содержимое контейнера списков на актуальные элементы.
   **********************************************/
  function rerenderList(listEl, tasks) {
    empty(listEl);
    tasks.forEach((t) => {
      listEl.appendChild(renderItem(t));
    });
  }

  /** *********************************************************
   * Инициализация каркаса и UI
   * Описание: заголовок-заглушка, контейнер и рендер todo-листа.
   **********************************************************/
  function bootstrap(gadgetEl) {
    if (!gadgetEl) {
      return;
    }

    const headerEl = gadgetEl.querySelector(HEADER_SELECTOR);
    if (headerEl) {
      headerEl.textContent = 'Jira Mini Tasks';
    }

    const contentEl = gadgetEl.querySelector(CONTENT_SELECTOR);
    if (!contentEl) {
      return;
    }

    const alreadyMounted = contentEl.querySelector(`#${WRAPPER_ID}`);
    if (alreadyMounted) {
      return;
    }

    empty(contentEl);

    const wrapper = el('div', { id: WRAPPER_ID });
    wrapper.style.padding = '12px 12px';
    wrapper.style.border = '1px solid #e5e5e5';
    wrapper.style.borderRadius = '8px';
    wrapper.style.background = '#fff';

    contentEl.appendChild(wrapper);

    const tasks = loadTasks();
    renderUI(wrapper, tasks);
    setupGlobalMenuCloser();
  }

  /** *****************************************
   * Точка входа
   * Описание: ожидание контейнера и запуск приложения.
   ******************************************/
  function main() {
    pollForGadget(bootstrap);
  }

  main();
})();
