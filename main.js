// ==UserScript==
// @name         Jira Mini Tasks
// @description  Adds personal To-Do list linked to JIRA issues
// @namespace    http://tampermonkey.net/
// @version      0.2.2
// @author       rs.fomin@rbspayment.ru
// @match        https://jira.theteamsoft.com/secure/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
  'use strict';

  /** *******************************
   * Константы
   **********************************/
  const GADGET_ID = 'gadget-20269-chrome';
  const HEADER_SELECTOR = 'dashboard-item-header > h2.gadget-20269-title';
  const CONTENT_SELECTOR = '.dashboard-item-content';
  const WRAPPER_ID = 'tm-smart-tasks';
  const INIT_POLL_MS = 800;
  const INIT_POLL_MAX_TRIES = 60;
  const STORAGE_KEY = 'tmSmartTasks.items';

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

    const title = el('div', { className: 'tm-title', text: 'Smart Tasks' });
    title.style.fontWeight = '600';
    title.style.marginBottom = '8px';

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

    root.appendChild(title);
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

    const checkbox = el('input', { type: 'checkbox' });
    checkbox.checked = !!task.done;

    const text = el('span', { className: 'tm-item-text', text: task.text });
    text.style.flex = '1';
    text.style.userSelect = 'none';
    text.style.wordBreak = 'break-word';
    if (task.done) {
      text.style.textDecoration = 'line-through';
      text.style.opacity = '0.7';
    }

    const editBtn = el('button', { type: 'button', text: 'Редактировать' });
    editBtn.style.padding = '4px 8px';
    editBtn.style.border = '1px solid #bdbdbd';
    editBtn.style.borderRadius = '6px';
    editBtn.style.background = '#f3f3f3';
    editBtn.style.cursor = 'pointer';

    const deleteBtn = el('button', { type: 'button', text: 'Удалить' });
    deleteBtn.style.padding = '4px 8px';
    deleteBtn.style.border = '1px solid #bdbdbd';
    deleteBtn.style.borderRadius = '6px';
    deleteBtn.style.background = '#f3f3f3';
    deleteBtn.style.cursor = 'pointer';

    row.appendChild(checkbox);
    row.appendChild(text);
    row.appendChild(editBtn);
    row.appendChild(deleteBtn);

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

    editBtn.addEventListener('click', () => {
      startEditMode(row, task);
    });

    deleteBtn.addEventListener('click', () => {
      const tasks = loadTasks();
      const next = tasks.filter((x) => String(x.id) !== String(task.id));
      saveTasks(next);
      const list = row.parentElement;
      if (list) {
        rerenderList(list, next);
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
    const oldButtons = Array.from(row.querySelectorAll('button'));
    oldButtons.forEach((btn) => {
      row.removeChild(btn);
    });
    row.appendChild(saveBtn);
    row.appendChild(cancelBtn);

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
      headerEl.textContent = 'Smart Tasks — draft';
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
    wrapper.style.padding = '8px 10px';
    wrapper.style.border = '1px solid #e5e5e5';
    wrapper.style.borderRadius = '8px';
    wrapper.style.background = '#fff';

    contentEl.appendChild(wrapper);

    const tasks = loadTasks();
    renderUI(wrapper, tasks);
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
