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
   * Обертка для запросов к Jira REST API
   * Описание: единая функция с логированием, JSON-парсингом и обработкой ошибок.
   **********************************************/
  function jiraRequest({ method = 'GET', url, body = null, message = null }) {
    if (!url) {
      console.error('tpm:error', 'URL is required');
      return Promise.resolve(null);
    }

    return fetch(url, {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : null,
    })
      .then(async (res) => {
        const text = await res.text();

        if (!res.ok) {
          console.error('tpm:error', res.status, text);
          return null;
        }

        let json = null;
        try {
          json = JSON.parse(text);
        } catch (e) {
          console.warn('tpm: not JSON', text);
          return text;
        }

        if (message) {
          console.log(`tpm message: ${message}`);
        }

        console.log('tpm: json =', json);

        return json;
      })
      .catch((err) => {
        console.error('tpm:error', err);
        return null;
      });
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
   * Автоподгон высоты textarea под содержимое
   * Описание: убирает вертикальный скролл и растит поле по мере ввода.
   **********************************************/
  function autosizeTextarea(ta) {
    if (!ta) return;
    const maxLines = 6;
    const resize = () => {
      // Считаем по контенту: min/max по высоте содержимого без padding/border
      const cs = getComputedStyle(ta);
      const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) || 16;
      const pt = parseFloat(cs.paddingTop) || 0;
      const pb = parseFloat(cs.paddingBottom) || 0;
      const padding = pt + pb; // scrollHeight включает padding

      ta.style.height = 'auto';
      const raw = ta.scrollHeight; // контент + padding
      const contentRaw = Math.max(0, raw - padding);
      const minContent = Math.ceil(line);
      const maxContent = Math.ceil(line * maxLines);
      const contentNext = Math.min(Math.max(contentRaw, minContent), maxContent);

      ta.style.height = `${contentNext}px`; // задаём высоту контент-бокса
      ta.style.overflowY = contentRaw > maxContent ? 'auto' : 'hidden';
    };
    ta.addEventListener('input', resize);
    // Первичный и отложенный пересчёт (на случай вставки в DOM позже)
    resize();
    requestAnimationFrame(resize);
    setTimeout(resize, 0);
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
    form.style.flexWrap = 'wrap';

    const input = el('textarea', { placeholder: 'Новая задача…', id: 'tm-input', rows: '1', wrap: 'soft' });
    input.style.flex = '1';
    input.style.padding = '6px 8px';
    input.style.border = '1px solid #dcdcdc';
    input.style.borderRadius = '6px';
    input.style.resize = 'none';
    input.style.overflow = 'hidden';
    input.style.lineHeight = '1.4';

    const addBtn = el('button', { type: 'button', id: 'tm-add-btn', text: '➤' });
    addBtn.style.padding = '6px 10px';
    addBtn.style.border = '1px solid #3572b0';
    addBtn.style.borderRadius = '6px';
    addBtn.style.background = '#4a9ae9';
    addBtn.style.color = '#fff';
    addBtn.style.cursor = 'pointer';
    // Не растягивать кнопку по высоте вместе с textarea
    addBtn.style.height = '32px';
    addBtn.style.display = 'inline-flex';
    addBtn.style.alignItems = 'center';
    addBtn.style.justifyContent = 'center';
    addBtn.style.flex = '0 0 auto';
    addBtn.style.alignSelf = 'flex-start';

    form.appendChild(input);
    form.appendChild(addBtn);
    const hintAdd = el('div', { className: 'tm-hint-add', text: 'Ctrl/Cmd+Enter — добавить' });
    hintAdd.style.fontSize = '12px';
    hintAdd.style.color = '#777';
    hintAdd.style.flexBasis = '100%';
    hintAdd.style.marginTop = '-4px';
    form.appendChild(hintAdd);
    // После вставки в DOM корректно вычисляем высоту
    autosizeTextarea(input);

    const list = el('div', { id: 'tm-list' });
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '6px';

    initialTasks.forEach((t) => {
      list.appendChild(renderItem(t));
    });

    root.appendChild(form);

    // Панель с примерами API-запросов к Jira
    const apiBar = el('div', { className: 'tm-api-bar' });
    apiBar.style.display = 'flex';
    apiBar.style.gap = '8px';
    apiBar.style.margin = '6px 0 10px';

    const btnSearchMy = el('button', { type: 'button', text: 'API: Мои задачи' });
    btnSearchMy.style.padding = '4px 8px';
    btnSearchMy.style.border = '1px solid #3572b0';
    btnSearchMy.style.borderRadius = '6px';
    btnSearchMy.style.background = '#e8f2fd';
    btnSearchMy.style.cursor = 'pointer';
    btnSearchMy.addEventListener('click', () => {
      jiraRequest({
        method: 'POST',
        url: 'https://jira.theteamsoft.com/rest/api/2/search',
        body: {
          jql: 'assignee = currentUser() ORDER BY created DESC',
          maxResults: 10,
          fields: ['key', 'summary', 'status'],
        },
        message: 'tpm: +++ search my issues',
      });
    });

    const btnServerInfo = el('button', { type: 'button', text: 'API: ServerInfo' });
    btnServerInfo.style.padding = '4px 8px';
    btnServerInfo.style.border = '1px solid #3572b0';
    btnServerInfo.style.borderRadius = '6px';
    btnServerInfo.style.background = '#e8f2fd';
    btnServerInfo.style.cursor = 'pointer';
    btnServerInfo.addEventListener('click', () => {
      jiraRequest({
        method: 'GET',
        url: 'https://jira.theteamsoft.com/rest/api/2/serverInfo',
        message: 'tpm: +++ serverInfo',
      });
    });

    apiBar.appendChild(btnSearchMy);
    apiBar.appendChild(btnServerInfo);
    root.appendChild(apiBar);
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
      // Вернуть поле к высоте в одну строку
      input.dispatchEvent(new Event('input'));
      rerenderList(list, next);
      input.focus();
    });

    // Добавление по Ctrl/Cmd+Enter, Enter делает перенос строки
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
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
    text.style.cursor = 'text';
    text.title = 'Нажмите, чтобы редактировать';
    if (task.done) {
      text.style.textDecoration = 'line-through';
      text.style.opacity = '0.7';
    }

    // Примечание: ссылка Jira будет добавлена после основных элементов, чтобы оказаться под задачей

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

    // Jira-ссылка под задачей (если есть). Одна строка с многоточием.
    if (task.jiraUrl || task.jiraText) {
      const jiraView = el('div', { className: 'tm-jira-link-wrap' });
      jiraView.style.flexBasis = '100%';
      jiraView.style.marginTop = '4px';
      jiraView.style.overflow = 'hidden';
      const linkText = task.jiraText || task.jiraUrl || '';
      const jiraA = el('a', { href: task.jiraUrl || '#', text: linkText, target: '_blank', rel: 'noopener noreferrer' });
      jiraA.style.color = '#3572b0';
      jiraA.style.textDecoration = 'underline';
      jiraA.style.display = 'inline-block';
      jiraA.style.maxWidth = '100%';
      jiraA.style.whiteSpace = 'nowrap';
      jiraA.style.overflow = 'hidden';
      jiraA.style.textOverflow = 'ellipsis';
      jiraView.appendChild(jiraA);
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
      // Не разрешаем перетаскивание в режиме редактирования
      if (row.dataset && row.dataset.editing === '1') {
        row.draggable = false;
        return;
      }
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
    // Кнопка редактирования удалена из разметки — ничего убирать не нужно
    const oldMenuWrap = row.querySelector('.tm-menu-wrap');
    if (oldMenuWrap) {
      row.removeChild(oldMenuWrap);
    }
    // В режиме редактирования переносим действия под строку
    row.style.flexWrap = 'wrap';
    // Помечаем строку как редактируемую и отключаем ручку перетаскивания
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

    // Кнопка для добавления/удаления Jira-ссылки
    let jiraEnabled = !!(task.jiraUrl);
    let jiraViewRef = null; // будет заполнен ниже, если превью существует
    const jiraBtn = el('button', { type: 'button' });
    jiraBtn.style.padding = '4px 8px';
    jiraBtn.style.border = '1px solid #bdbdbd';
    jiraBtn.style.borderRadius = '6px';
    jiraBtn.style.background = '#f3f3f3';
    jiraBtn.style.cursor = 'pointer';
    const setJiraBtnText = () => {
      jiraBtn.textContent = jiraEnabled ? '− Jira' : '+ Jira';
    };
    setJiraBtnText();

    // Область ввода Jira-ссылки (появляется по нажатию "Добавить")
    const jiraWrap = el('div', { className: 'tm-jira-edit' });
    jiraWrap.style.display = 'none';
    jiraWrap.style.flexBasis = '94%'; // todo как-то поправить 94
    jiraWrap.style.marginTop = '6px';
    const jiraInput = el('input', { type: 'text', placeholder: '[[UI-5320] Название](https://jira.theteamsoft.com/browse/UI-5320)' });
    jiraInput.style.width = '100%';
    jiraInput.style.padding = '6px 8px';
    jiraInput.style.border = '1px solid #dcdcdc';
    jiraInput.style.borderRadius = '6px';
    jiraWrap.appendChild(jiraInput);

    // Если уже есть Jira-ссылка, не показываем инпут до клика, но подготовим значение
    const toMarkdown = (text, url) => (text && url ? `[${text}](${url})` : (url ? url : ''));
    const fromMarkdown = (src) => {
      if (!src) return null;
      const m = src.match(/^\s*\[(.+?)\]\((https?:\/\/[^)\s]+)\)\s*$/);
      if (m) return { text: m[1], url: m[2] };
      // fallback: если просто URL
      const urlMatch = src.match(/https?:\/\/[^\s)]+/);
      if (urlMatch) return { text: src.replace(urlMatch[0], '').trim() || urlMatch[0], url: urlMatch[0] };
      return null;
    };

    jiraBtn.addEventListener('click', () => {
      jiraEnabled = !jiraEnabled;
      setJiraBtnText();
      if (jiraEnabled) {
        jiraWrap.style.display = 'block';
        if (!jiraInput.value) {
          jiraInput.value = toMarkdown(task.jiraText || '', task.jiraUrl || '');
        }
        jiraInput.focus();
        // Возвращаем превью, если оно было и мы снова включаем Jira
        if (jiraViewRef) {
          jiraViewRef.style.display = 'block';
        }
      } else {
        jiraWrap.style.display = 'none';
        // Визуально скрываем превью ссылки до сохранения
        if (jiraViewRef) {
          jiraViewRef.style.display = 'none';
        }
      }
    });

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    actions.appendChild(jiraBtn);
    row.appendChild(actions);
    // После вставки поля в DOM скорректируем высоту
    autosizeTextarea(input);
    const hintEdit = el('div', { className: 'tm-hint-edit', text: 'Ctrl/Cmd+Enter — сохранить, Esc — отменить' });
    hintEdit.style.fontSize = '12px';
    hintEdit.style.color = '#777';
    hintEdit.style.flexBasis = '100%';
    hintEdit.style.marginTop = '2px';
    row.appendChild(hintEdit);
    row.appendChild(jiraWrap);
    // Используем уже существующее превью Jira-ссылки в строке
    jiraViewRef = row.querySelector('.tm-jira-link-wrap') || null;

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
        // Применяем Jira-ссылку согласно состоянию
        if (!jiraEnabled) {
          delete tasks[idx].jiraUrl;
          delete tasks[idx].jiraText;
        } else {
          // Если показан инпут и есть значение — парсим
          if (jiraWrap.style.display !== 'none' && jiraInput.value.trim()) {
            const parsed = fromMarkdown(jiraInput.value.trim());
            if (parsed) {
              tasks[idx].jiraUrl = parsed.url;
              tasks[idx].jiraText = parsed.text;
            }
          } else if (task.jiraUrl) {
            // оставляем существующие значения, если инпут не трогали
            tasks[idx].jiraUrl = task.jiraUrl;
            tasks[idx].jiraText = task.jiraText;
          }
        }
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
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveBtn.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
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
    updateHeaderCounts(tasks);
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
    updateHeaderCounts(tasks);
    setupGlobalMenuCloser();
  }

  /** *********************************************
   * Обновление заголовка виджета с количеством задач
   * Описание: выводит всего, решенных и нерешенных.
   **********************************************/
  function updateHeaderCounts(tasks) {
    try {
      const headerEl = document.querySelector(HEADER_SELECTOR);
      if (!headerEl) return;
      const total = Array.isArray(tasks) ? tasks.length : 0;
      const done = Array.isArray(tasks) ? tasks.filter((t) => t && t.done).length : 0;
      const undone = Math.max(0, total - done);
      headerEl.textContent = `Jira Mini Tasks ∑ ${total} (✔ ${done}/✘ ${undone})`;
    } catch (e) {}
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
