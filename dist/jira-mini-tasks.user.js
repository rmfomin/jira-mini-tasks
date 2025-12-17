// ==UserScript==
// @name         Jira Mini Tasks
// @description  Adds personal To-Do list linked to JIRA issues
// @namespace    http://tampermonkey.net/
// @version      0.4.0
// @author       rs.fomin@rbspayment.ru
// @match        https://jira.theteamsoft.com/secure/*
// @match        https://jira.theteamsoft.com/browse/*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==


(() => {
  // src/constants.js
  var numberId = "20269";
  var GADGET_ID = `gadget-${numberId}-chrome`;
  var HEADER_SELECTOR = `#gadget-${numberId}-title`;
  var CONTENT_SELECTOR = ".dashboard-item-content";
  var WRAPPER_ID = "tm-smart-tasks";
  var INIT_POLL_MS = 800;
  var INIT_POLL_MAX_TRIES = 60;
  var STORAGE_KEY = "tmSmartTasks.items";

  // src/utils/dom.js
  function empty(el2) {
    if (!el2) {
      return;
    }
    while (el2.firstChild) {
      el2.removeChild(el2.firstChild);
    }
  }
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "className") {
        node.className = v;
      } else if (k === "text") {
        node.textContent = v;
      } else if (k === "html") {
        node.innerHTML = v;
      } else {
        node.setAttribute(k, v);
      }
    });
    children.forEach((c) => {
      if (typeof c === "string") {
        node.appendChild(document.createTextNode(c));
      } else if (c instanceof Node) {
        node.appendChild(c);
      }
    });
    return node;
  }
  function autosizeTextarea(ta) {
    if (!ta) {
      return;
    }
    const maxLines = 6;
    const resize = () => {
      const cs = getComputedStyle(ta);
      const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) || 16;
      const pt = parseFloat(cs.paddingTop) || 0;
      const pb = parseFloat(cs.paddingBottom) || 0;
      const padding = pt + pb;
      ta.style.height = "auto";
      const raw = ta.scrollHeight;
      const contentRaw = Math.max(0, raw - padding);
      const minContent = Math.ceil(line);
      const maxContent = Math.ceil(line * maxLines);
      const contentNext = Math.min(Math.max(contentRaw, minContent), maxContent);
      ta.style.height = `${contentNext}px`;
      ta.style.overflowY = contentRaw > maxContent ? "auto" : "hidden";
    };
    ta.addEventListener("input", resize);
    resize();
    requestAnimationFrame(resize);
    setTimeout(resize, 0);
  }

  // src/utils/poll.js
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
    return () => clearInterval(timer);
  }

  // src/storage/index.js
  function loadTasks() {
    try {
      const raw = GM_getValue(STORAGE_KEY, "[]");
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

  // src/ui/header.js
  function updateHeaderCounts(tasks) {
    try {
      const headerEl = document.querySelector(HEADER_SELECTOR);
      if (!headerEl) {
        return;
      }
      const total = Array.isArray(tasks) ? tasks.length : 0;
      const done = Array.isArray(tasks) ? tasks.filter((t) => t && t.done).length : 0;
      const undone = Math.max(0, total - done);
      headerEl.textContent = `Jira Mini Tasks \u2211 ${total} (\u2714 ${done}/\u2718 ${undone})`;
    } catch (e) {
    }
  }

  // src/ui/rerender.js
  function rerenderList(listEl, tasks, renderItem2) {
    empty(listEl);
    tasks.forEach((t) => {
      listEl.appendChild(renderItem2(t));
    });
    updateHeaderCounts(tasks);
  }

  // src/dnd/index.js
  var dragState = {
    isDragging: false,
    draggedElement: null,
    ghostElement: null,
    dropIndicator: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    initialParent: null,
    initialNextSibling: null
  };
  function persistOrderFromDom(listEl) {
    const ids = Array.from(listEl.children).map((n) => n.dataset && n.dataset.id).filter(Boolean);
    const tasks = loadTasks();
    const map = new Map(tasks.map((t) => [String(t.id), t]));
    const next = ids.map((id) => map.get(String(id))).filter(Boolean);
    if (next.length === tasks.length) {
      saveTasks(next);
      return next;
    }
    return tasks;
  }
  function createDropIndicator() {
    const indicator = document.createElement("div");
    indicator.className = "tm-drop-indicator";
    indicator.style.height = "3px";
    indicator.style.background = "#4a9ae9";
    indicator.style.borderRadius = "2px";
    indicator.style.margin = "2px 0";
    indicator.style.boxShadow = "0 0 4px rgba(74, 154, 233, 0.6)";
    indicator.style.pointerEvents = "none";
    return indicator;
  }
  function findDropTarget(clientY, listEl) {
    const items = Array.from(listEl.children).filter(
      (el2) => el2.classList.contains("tm-item") && el2 !== dragState.draggedElement
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
  function updateDropIndicator(clientY, listEl) {
    if (!dragState.dropIndicator || !listEl) {
      return;
    }
    const target = findDropTarget(clientY, listEl);
    if (!target.element) {
      if (listEl.children.length === 0 || listEl.children.length === 1 && listEl.children[0] === dragState.draggedElement) {
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
  function startDrag(element, event) {
    if (element.dataset && element.dataset.editing === "1") {
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
    ghost.className = "tm-item-ghost";
    ghost.style.position = "fixed";
    ghost.style.left = rect.left + "px";
    ghost.style.top = rect.top + "px";
    ghost.style.width = rect.width + "px";
    ghost.style.opacity = "0.8";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "10000";
    ghost.style.transition = "none";
    ghost.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
    document.body.appendChild(ghost);
    dragState.ghostElement = ghost;
    element.style.opacity = "0.3";
    dragState.dropIndicator = createDropIndicator();
    document.addEventListener("mousemove", handleDragMove);
    document.addEventListener("mouseup", handleDragEnd);
  }
  function handleDragMove(event) {
    if (!dragState.isDragging || !dragState.ghostElement || !dragState.draggedElement) {
      return;
    }
    const x = event.clientX - dragState.offsetX;
    const y = event.clientY - dragState.offsetY;
    dragState.ghostElement.style.left = x + "px";
    dragState.ghostElement.style.top = y + "px";
    const listEl = dragState.initialParent;
    if (listEl) {
      updateDropIndicator(event.clientY, listEl);
    }
  }
  function handleDragEnd(event) {
    if (!dragState.isDragging) {
      return;
    }
    document.removeEventListener("mousemove", handleDragMove);
    document.removeEventListener("mouseup", handleDragEnd);
    if (dragState.ghostElement) {
      dragState.ghostElement.remove();
    }
    if (dragState.draggedElement) {
      dragState.draggedElement.style.opacity = "1";
    }
    const listEl = dragState.initialParent;
    if (dragState.dropIndicator && dragState.dropIndicator.parentElement && dragState.draggedElement) {
      const indicator = dragState.dropIndicator;
      const parent = indicator.parentElement;
      if (parent === listEl) {
        parent.insertBefore(dragState.draggedElement, indicator);
        indicator.remove();
        const updatedTasks = persistOrderFromDom(listEl);
        if (window.__tmDeactivateSortButton) {
          window.__tmDeactivateSortButton();
        }
        const rerenderModule = window.__tmRerenderList;
        const renderItemModule = window.__tmRenderItem;
        if (rerenderModule && renderItemModule) {
          rerenderModule(listEl, updatedTasks, renderItemModule);
        }
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
      initialNextSibling: null
    };
  }

  // src/utils/task-parsing.js
  function extractJiraKey(text) {
    const match = text.match(/\b([A-Z]+-\d+)\b/);
    return match ? match[1] : null;
  }
  function extractDueDate(text) {
    const match = text.match(/@([a-zа-яё]+)/i);
    if (!match) {
      return null;
    }
    const keyword = match[1].toLowerCase();
    const dateMap = {
      today: "today",
      tomorrow: "tomorrow",
      thisweek: "thisweek",
      nextweek: "nextweek",
      later: "later",
      forgotten: "forgotten",
      \u0441\u0435\u0433\u043E\u0434\u043D\u044F: "today",
      \u0437\u0430\u0432\u0442\u0440\u0430: "tomorrow",
      \u044D\u0442\u0430\u043D\u0435\u0434\u0435\u043B\u044F: "thisweek",
      \u0441\u043B\u0435\u0434\u043D\u0435\u0434\u0435\u043B\u044F: "nextweek",
      \u043F\u043E\u0437\u0436\u0435: "later",
      \u043F\u043E\u0437\u0434\u043D\u0435\u0435: "later",
      \u0437\u0430\u0431\u044B\u0442\u043E: "forgotten"
    };
    const normalizedKey = dateMap[keyword];
    if (!normalizedKey) {
      return null;
    }
    return parseDateKeyword(normalizedKey);
  }
  function parseDateKeyword(keyword) {
    const now = /* @__PURE__ */ new Date();
    const labels = {
      today: "\u0421\u0435\u0433\u043E\u0434\u043D\u044F",
      tomorrow: "\u0417\u0430\u0432\u0442\u0440\u0430",
      thisweek: "\u042D\u0442\u0430 \u043D\u0435\u0434\u0435\u043B\u044F",
      nextweek: "\u0421\u043B\u0435\u0434.\u043D\u0435\u0434\u0435\u043B\u044F",
      later: "\u041F\u043E\u0437\u0436\u0435",
      forgotten: "\u0417\u0430\u0431\u044B\u0442\u043E"
    };
    let targetDate = new Date(now);
    let startDate = null;
    switch (keyword) {
      case "today":
        break;
      case "tomorrow":
        targetDate.setDate(now.getDate() + 1);
        break;
      case "thisweek":
        startDate = new Date(now);
        targetDate.setDate(now.getDate() + (7 - now.getDay()));
        break;
      case "nextweek":
        startDate = new Date(now);
        startDate.setDate(now.getDate() + (7 - now.getDay()) + 1);
        targetDate.setDate(now.getDate() + (14 - now.getDay()));
        break;
      case "later":
        targetDate.setDate(now.getDate() + 30);
        break;
      case "forgotten":
        targetDate.setDate(now.getDate() - 365);
        break;
      default:
        return null;
    }
    return {
      date: targetDate.toISOString().split("T")[0],
      label: labels[keyword],
      startDate: startDate ? startDate.toISOString().split("T")[0] : null,
      type: keyword
    };
  }
  async function fetchJiraIssue(issueKey) {
    try {
      const response = await fetch(`https://jira.theteamsoft.com/rest/api/2/issue/${issueKey}?fields=summary`, {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      });
      const data = await response.json();
      if (data.errorMessages || data.errors) {
        return { error: true };
      }
      return {
        key: data.key,
        summary: data.fields.summary,
        url: `https://jira.theteamsoft.com/browse/${data.key}`
      };
    } catch (err) {
      console.error("tpm: \u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 Jira issue:", err);
      return { error: true };
    }
  }

  // src/ui/item.js
  function renderItem(task) {
    const row = el("div", { className: "tm-item" });
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.flexWrap = "wrap";
    row.style.padding = "6px";
    row.style.paddingRight = "20px";
    row.style.border = "1px solid #ededed";
    row.style.borderRadius = "6px";
    row.style.position = "relative";
    row.dataset.id = String(task.id);
    if (task.done) {
      row.style.background = "#f5f5f5";
    }
    const drag = el("span", { className: "tm-drag", text: "\u283F" });
    drag.style.cursor = "grab";
    drag.style.userSelect = "none";
    drag.style.color = "#9e9e9e";
    drag.style.fontSize = "20px";
    drag.style.lineHeight = "1";
    drag.style.padding = "2px 4px";
    const checkbox = el("input", { type: "checkbox" });
    checkbox.checked = !!task.done;
    checkbox.style.transform = "scale(1.5)";
    checkbox.style.margin = "0";
    checkbox.style.marginRight = "16px";
    checkbox.style.marginLeft = "8px";
    const text = el("span", { className: "tm-item-text", text: task.text });
    text.style.flex = "1";
    text.style.userSelect = "none";
    text.style.wordBreak = "break-word";
    text.style.whiteSpace = "pre-wrap";
    text.style.cursor = "text";
    text.style.fontSize = "14px";
    text.style.lineHeight = "1.4";
    text.title = "\u041D\u0430\u0436\u043C\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u0440\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C";
    const deleteBtn = el("button", { type: "button", text: "\xD7", title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443" });
    deleteBtn.style.position = "absolute";
    deleteBtn.style.top = "6px";
    deleteBtn.style.right = "6px";
    deleteBtn.style.width = "18px";
    deleteBtn.style.height = "18px";
    deleteBtn.style.padding = "0";
    deleteBtn.style.border = "none";
    deleteBtn.style.borderRadius = "4px";
    deleteBtn.style.background = "transparent";
    deleteBtn.style.color = "#9e9e9e";
    deleteBtn.style.fontSize = "18px";
    deleteBtn.style.lineHeight = "1";
    deleteBtn.style.cursor = "pointer";
    deleteBtn.style.opacity = "0";
    deleteBtn.style.transition = "opacity 0.2s ease, color 0.1s ease";
    deleteBtn.style.display = "flex";
    deleteBtn.style.alignItems = "center";
    deleteBtn.style.justifyContent = "center";
    deleteBtn.addEventListener("mouseover", () => {
      deleteBtn.style.color = "#d32f2f";
    });
    deleteBtn.addEventListener("mouseout", () => {
      deleteBtn.style.color = "#9e9e9e";
    });
    row.appendChild(drag);
    row.appendChild(checkbox);
    row.appendChild(text);
    row.appendChild(deleteBtn);
    row.addEventListener("mouseover", () => {
      deleteBtn.style.opacity = "1";
    });
    row.addEventListener("mouseout", () => {
      deleteBtn.style.opacity = "0";
    });
    const linksWrap = el("div", { className: "tm-links-wrap" });
    linksWrap.style.flexBasis = "100%";
    linksWrap.style.marginTop = "10px";
    linksWrap.style.display = "flex";
    linksWrap.style.gap = "10px";
    linksWrap.style.flexWrap = "wrap";
    linksWrap.style.height = "30px";
    if (task.done) {
      const doneBtnWrap = el("div", { className: "tm-done-btn-wrap" });
      doneBtnWrap.style.position = "relative";
      doneBtnWrap.style.display = "inline-block";
      doneBtnWrap.style.lineHeight = "0";
      const doneBtn = el("button", { type: "button" });
      doneBtn.style.padding = "6px 12px";
      doneBtn.style.height = "100%";
      doneBtn.style.border = "1px solid #66bb6a";
      doneBtn.style.borderRadius = "8px";
      doneBtn.style.background = "#e8f5e9";
      doneBtn.style.color = "#2e7d32";
      doneBtn.style.cursor = "default";
      doneBtn.style.fontSize = "12px";
      doneBtn.style.fontWeight = "400";
      doneBtn.style.lineHeight = "1";
      doneBtn.style.whiteSpace = "nowrap";
      doneBtn.style.display = "flex";
      doneBtn.style.alignItems = "center";
      doneBtn.style.gap = "6px";
      doneBtn.textContent = "\u2713 \u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E";
      doneBtnWrap.appendChild(doneBtn);
      linksWrap.appendChild(doneBtnWrap);
    }
    if (task.dueDate && task.dueDateLabel) {
      const overdue = isOverdue(task.dueDate);
      let titleText = "";
      if (task.dueDateType === "thisweek" || task.dueDateType === "nextweek") {
        if (task.dueDateStart) {
          titleText = formatDateRange(task.dueDateStart, task.dueDate);
        }
      } else if (task.dueDateType !== "later") {
        titleText = formatDateDisplay(task.dueDate);
      }
      const dateBtnWrap = el("div", { className: "tm-date-btn-wrap" });
      dateBtnWrap.style.position = "relative";
      dateBtnWrap.style.display = "inline-block";
      dateBtnWrap.style.lineHeight = "0";
      const dateBtn = el("button", { type: "button", title: titleText });
      dateBtn.style.padding = "6px 12px";
      dateBtn.style.height = "100%";
      dateBtn.style.border = overdue ? "1px solid #c62828" : "1px solid #d0d0d0";
      dateBtn.style.borderRadius = "8px";
      dateBtn.style.background = overdue ? "#ffebee" : "#f5f5f5";
      dateBtn.style.color = overdue ? "#c62828" : "#424242";
      dateBtn.style.cursor = "default";
      dateBtn.style.fontSize = "12px";
      dateBtn.style.fontWeight = "400";
      dateBtn.style.lineHeight = "1";
      dateBtn.style.whiteSpace = "nowrap";
      dateBtn.style.display = "flex";
      dateBtn.style.alignItems = "center";
      dateBtn.style.gap = "6px";
      dateBtn.style.transition = "background 0.2s ease";
      dateBtn.style.position = "relative";
      const dateText = overdue ? formatDateDisplay(task.dueDate) : task.dueDateLabel;
      dateBtn.textContent = `\uFF20 ${dateText}`;
      const gradientBg = overdue ? "#ffebee" : "#f5f5f5";
      const gradientHoverBg = overdue ? "#ffcdd2" : "#e8e8e8";
      const gradient = el("div", { className: "tm-btn-gradient" });
      gradient.style.position = "absolute";
      gradient.style.top = "0";
      gradient.style.right = "0";
      gradient.style.bottom = "0";
      gradient.style.width = "50px";
      gradient.style.background = `linear-gradient(to right, ${hexToRgba(gradientBg, 0)} 0%, ${hexToRgba(gradientBg, 1)} 50%)`;
      gradient.style.pointerEvents = "none";
      gradient.style.opacity = "0";
      gradient.style.transition = "opacity 0.2s ease";
      gradient.style.borderRadius = "0 8px 8px 0";
      const closeBtn = el("button", { type: "button", text: "\xD7", title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0434\u0430\u0442\u0443" });
      closeBtn.style.position = "absolute";
      closeBtn.style.top = "50%";
      closeBtn.style.right = "4px";
      closeBtn.style.transform = "translateY(-50%)";
      closeBtn.style.width = "20px";
      closeBtn.style.height = "20px";
      closeBtn.style.padding = "0";
      closeBtn.style.border = "none";
      closeBtn.style.background = "transparent";
      closeBtn.style.color = overdue ? "#c62828" : "#666";
      closeBtn.style.fontSize = "20px";
      closeBtn.style.lineHeight = "1";
      closeBtn.style.cursor = "pointer";
      closeBtn.style.opacity = "0";
      closeBtn.style.transition = "opacity 0.2s ease, color 0.1s ease";
      closeBtn.style.display = "flex";
      closeBtn.style.alignItems = "center";
      closeBtn.style.justifyContent = "center";
      closeBtn.addEventListener("mouseover", () => {
        closeBtn.style.color = "#d32f2f";
      });
      closeBtn.addEventListener("mouseout", () => {
        closeBtn.style.color = overdue ? "#c62828" : "#666";
      });
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const tasks = loadTasks();
        const idx = tasks.findIndex((x) => String(x.id) === String(task.id));
        if (idx !== -1) {
          delete tasks[idx].dueDate;
          delete tasks[idx].dueDateLabel;
          delete tasks[idx].dueDateStart;
          delete tasks[idx].dueDateType;
          saveTasks(tasks);
          const list = row.parentElement;
          if (list) {
            rerenderList(list, tasks, renderItem);
          }
        }
      });
      dateBtn.appendChild(gradient);
      dateBtn.appendChild(closeBtn);
      dateBtnWrap.appendChild(dateBtn);
      dateBtnWrap.addEventListener("mouseover", () => {
        dateBtn.style.background = gradientHoverBg;
        gradient.style.background = `linear-gradient(to right, ${hexToRgba(gradientHoverBg, 0)} 0%, ${hexToRgba(gradientHoverBg, 1)} 50%)`;
        gradient.style.opacity = "1";
        closeBtn.style.opacity = "1";
      });
      dateBtnWrap.addEventListener("mouseout", () => {
        dateBtn.style.background = gradientBg;
        gradient.style.background = `linear-gradient(to right, ${hexToRgba(gradientBg, 0)} 0%, ${hexToRgba(gradientBg, 1)} 50%)`;
        gradient.style.opacity = "0";
        closeBtn.style.opacity = "0";
      });
      linksWrap.appendChild(dateBtnWrap);
    }
    if (task.jiraKey && task.jiraSummary) {
      const truncatedSummary = task.jiraSummary.length > 25 ? task.jiraSummary.substring(0, 25) + "\u2026" : task.jiraSummary;
      const jiraBtnWrap = el("div", { className: "tm-jira-btn-wrap" });
      jiraBtnWrap.style.position = "relative";
      jiraBtnWrap.style.display = "inline-block";
      jiraBtnWrap.style.lineHeight = "0";
      const jiraBtn = el("button", { type: "button", title: task.jiraSummary });
      jiraBtn.style.padding = "6px 12px";
      jiraBtn.style.height = "100%";
      jiraBtn.style.border = "1px solid #d0d0d0";
      jiraBtn.style.borderRadius = "8px";
      jiraBtn.style.background = "#f5f5f5";
      jiraBtn.style.color = "#424242";
      jiraBtn.style.cursor = "pointer";
      jiraBtn.style.fontSize = "12px";
      jiraBtn.style.fontWeight = "400";
      jiraBtn.style.lineHeight = "1";
      jiraBtn.style.whiteSpace = "nowrap";
      jiraBtn.style.overflow = "hidden";
      jiraBtn.style.textOverflow = "ellipsis";
      jiraBtn.style.transition = "background 0.2s ease";
      jiraBtn.style.textAlign = "left";
      jiraBtn.style.display = "flex";
      jiraBtn.style.alignItems = "center";
      jiraBtn.style.gap = "6px";
      jiraBtn.style.position = "relative";
      const jiraIcon = el("img");
      jiraIcon.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAALqSURBVHgB7ZdNT9RAGMefaTvtwbe6HDQhJnsBPG5i/AB8A4kfYCGe8KQxngwwVeJJIwcP3mg8G/UbrN9AjwYkbowElQjIKtB2puMzLWtg6cu065F/0nSYl/5/M8/MMyzAqYZQcz5YGF+UCzCEDKipc7c+twkAwyIbBqIewM33bcMAn9p2v6Y2RHUANAcp/PONkcGWWhCVANzZLzcIxD4uPViOndWlMoQ2wJnpldZ+r7dsmGZZ10oQWgDu7R8ty7Y7lDouvsGwLAj29+F/QJQCjN7fbjmO0UFjNKdgUXwQItjbKxvKJhblnbJOhQBjTLao43TQ1LWoDaZ1CIDvvV4PeBgWDQcJ8Gz8sWxDHYCrTDaJCW/Q2FXHjSYzp6DK6q32wub6OpQqBr8Iwsgzjyl0gEBTGZk0nTn9twp28rcQwpMxzMAQECTXXELzaD2aAY/CZNl5GEHEQ2/r+ShTbWMP5TQxYBnKOCRMfpoj73IB8syPQSCAOAi8r08vsqNtmhA7ksDk6gPyoV9xLARF5kpmGo4T5kqr88TXCIdLJHSaTLqZADqyLEvmtQkeXZBSgoayAYwIJjEo3ZLBmUlm9N52O4rCJcE5FEAkIegy0s0E+IgNdSDc2Y12yEOfR1G6R7IhTsRfiWR9vWwzHgVZX1npmjb11VGltoPH08J9Yqf5Ast9CyFham2OvB38AMn7si7E1vdv8OfXbpKeVbIyD5OVyhfpGyEMMoMz97PG525C3XA0Ll0GQggIzBERhkCEUZInhAoHPrHgueaFAH0IjOQUFneK+p11XYhUglKJiqf7QJlH4cHdNWb7RWNLj6HaNGrzFEGcbzSSGYvENF0JHgTexpORJSiRVh4og0j+ScEw8MPlRwhv68UVBhrSTkQ6KyFjgasQeAcvJxhoqlImVBB4oUwN1sd4R6hHgvTiV9cYVFDlVKxus8Gc/3tHLYr04PV1BhVV63fB4MWz+3OzlvnQUlfw+CPJ4FRD6C9T03iJQ2mrcgAAAABJRU5ErkJggg==";
      jiraIcon.alt = "Jira";
      jiraIcon.style.width = "16px";
      jiraIcon.style.height = "16px";
      jiraIcon.style.flexShrink = "0";
      const textSpan = el("span", { text: `${task.jiraKey} | ${truncatedSummary}` });
      textSpan.style.overflow = "hidden";
      textSpan.style.textOverflow = "ellipsis";
      textSpan.style.whiteSpace = "nowrap";
      const gradient = el("div", { className: "tm-btn-gradient" });
      gradient.style.position = "absolute";
      gradient.style.top = "0";
      gradient.style.right = "0";
      gradient.style.bottom = "0";
      gradient.style.width = "50px";
      gradient.style.background = "linear-gradient(to right, rgba(245, 245, 245, 0), rgba(245, 245, 245, 1) 50%)";
      gradient.style.pointerEvents = "none";
      gradient.style.opacity = "0";
      gradient.style.transition = "opacity 0.2s ease";
      gradient.style.borderRadius = "0 8px 8px 0";
      const closeBtn = el("button", { type: "button", text: "\xD7", title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C Jira-\u0437\u0430\u0434\u0430\u0447\u0443" });
      closeBtn.style.position = "absolute";
      closeBtn.style.top = "50%";
      closeBtn.style.right = "4px";
      closeBtn.style.transform = "translateY(-50%)";
      closeBtn.style.width = "20px";
      closeBtn.style.height = "20px";
      closeBtn.style.padding = "0";
      closeBtn.style.border = "none";
      closeBtn.style.background = "transparent";
      closeBtn.style.color = "#666";
      closeBtn.style.fontSize = "20px";
      closeBtn.style.lineHeight = "1";
      closeBtn.style.cursor = "pointer";
      closeBtn.style.opacity = "0";
      closeBtn.style.transition = "opacity 0.2s ease, color 0.1s ease";
      closeBtn.style.display = "flex";
      closeBtn.style.alignItems = "center";
      closeBtn.style.justifyContent = "center";
      closeBtn.addEventListener("mouseover", () => {
        closeBtn.style.color = "#d32f2f";
      });
      closeBtn.addEventListener("mouseout", () => {
        closeBtn.style.color = "#666";
      });
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const tasks = loadTasks();
        const idx = tasks.findIndex((x) => String(x.id) === String(task.id));
        if (idx !== -1) {
          delete tasks[idx].jiraKey;
          delete tasks[idx].jiraSummary;
          delete tasks[idx].jiraUrl;
          saveTasks(tasks);
          const list = row.parentElement;
          if (list) {
            rerenderList(list, tasks, renderItem);
          }
        }
      });
      jiraBtn.appendChild(jiraIcon);
      jiraBtn.appendChild(textSpan);
      jiraBtn.appendChild(gradient);
      jiraBtn.appendChild(closeBtn);
      jiraBtnWrap.appendChild(jiraBtn);
      jiraBtnWrap.addEventListener("mouseover", () => {
        jiraBtn.style.background = "#e8e8e8";
        gradient.style.background = "linear-gradient(to right, rgba(232, 232, 232, 0), rgba(232, 232, 232, 1) 50%)";
        gradient.style.opacity = "1";
        closeBtn.style.opacity = "1";
      });
      jiraBtnWrap.addEventListener("mouseout", () => {
        jiraBtn.style.background = "#f5f5f5";
        gradient.style.background = "linear-gradient(to right, rgba(245, 245, 245, 0), rgba(245, 245, 245, 1) 50%)";
        gradient.style.opacity = "0";
        closeBtn.style.opacity = "0";
      });
      jiraBtn.addEventListener("click", () => {
        window.open(task.jiraUrl || `https://jira.theteamsoft.com/browse/${task.jiraKey}`, "_blank", "noopener,noreferrer");
      });
      linksWrap.appendChild(jiraBtnWrap);
    }
    if (linksWrap.children.length > 0) {
      row.appendChild(linksWrap);
    }
    checkbox.addEventListener("change", () => {
      const tasks = loadTasks();
      const idx = tasks.findIndex((x) => String(x.id) === String(task.id));
      if (idx !== -1) {
        tasks[idx].done = !!checkbox.checked;
        if (checkbox.checked) {
          delete tasks[idx].dueDate;
          delete tasks[idx].dueDateLabel;
          delete tasks[idx].dueDateStart;
          delete tasks[idx].dueDateType;
        }
        const notDone = tasks.filter((t) => !t.done);
        const done = tasks.filter((t) => t.done);
        const sortedTasks = [...notDone, ...done];
        saveTasks(sortedTasks);
        const list = row.parentElement;
        if (list) {
          rerenderList(list, sortedTasks, renderItem);
        }
      }
    });
    text.addEventListener("click", () => {
      startEditMode(row, task);
    });
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const tasks = loadTasks();
      const next = tasks.filter((x) => String(x.id) !== String(task.id));
      saveTasks(next);
      const list = row.parentElement;
      if (list) {
        rerenderList(list, next, renderItem);
      }
    });
    drag.addEventListener("mousedown", (e) => {
      startDrag(row, e);
    });
    return row;
  }
  function formatDateDisplay(dateStr) {
    const date = new Date(dateStr);
    const months = ["\u044F\u043D\u0432\u0430\u0440\u044F", "\u0444\u0435\u0432\u0440\u0430\u043B\u044F", "\u043C\u0430\u0440\u0442\u0430", "\u0430\u043F\u0440\u0435\u043B\u044F", "\u043C\u0430\u044F", "\u0438\u044E\u043D\u044F", "\u0438\u044E\u043B\u044F", "\u0430\u0432\u0433\u0443\u0441\u0442\u0430", "\u0441\u0435\u043D\u0442\u044F\u0431\u0440\u044F", "\u043E\u043A\u0442\u044F\u0431\u0440\u044F", "\u043D\u043E\u044F\u0431\u0440\u044F", "\u0434\u0435\u043A\u0430\u0431\u0440\u044F"];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  }
  function formatDateRange(startDateStr, endDateStr) {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const monthsShort = ["\u044F\u043D\u0432", "\u0444\u0435\u0432", "\u043C\u0430\u0440", "\u0430\u043F\u0440", "\u043C\u0430\u044F", "\u0438\u044E\u043D", "\u0438\u044E\u043B", "\u0430\u0432\u0433", "\u0441\u0435\u043D", "\u043E\u043A\u0442", "\u043D\u043E\u044F", "\u0434\u0435\u043A"];
    if (startDate.getMonth() === endDate.getMonth()) {
      return `${startDate.getDate()} - ${endDate.getDate()} ${monthsShort[endDate.getMonth()]}`;
    }
    return `${startDate.getDate()} ${monthsShort[startDate.getMonth()]} - ${endDate.getDate()} ${monthsShort[endDate.getMonth()]}`;
  }
  function isOverdue(dateStr) {
    const now = /* @__PURE__ */ new Date();
    const due = new Date(dateStr);
    now.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return due < now;
  }
  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  function startEditMode(row, task) {
    const list = row.parentElement;
    if (list) {
      const editingItems = list.querySelectorAll('[data-editing="1"]');
      if (editingItems.length > 0) {
        const tasks = loadTasks();
        rerenderList(list, tasks, renderItem);
        const newRow = list.querySelector(`[data-id="${task.id}"]`);
        if (newRow) {
          row = newRow;
        }
      }
    }
    const currentTextEl = row.querySelector(".tm-item-text");
    if (!currentTextEl) {
      return;
    }
    const input = el("textarea", { rows: "1", wrap: "soft" });
    input.value = task.text;
    input.style.flex = "1";
    input.style.padding = "0";
    input.style.border = "none";
    input.style.outline = "none";
    input.style.borderRadius = "6px";
    input.style.resize = "none";
    input.style.overflow = "hidden";
    input.style.lineHeight = "1.4";
    input.style.fontSize = "14px";
    row.replaceChild(input, currentTextEl);
    const deleteBtn = row.querySelector('button[title="\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443"]');
    if (deleteBtn) {
      deleteBtn.style.display = "none";
    }
    row.style.flexWrap = "wrap";
    row.style.border = "1px solid #1976d2";
    row.dataset.editing = "1";
    const dragHandle = row.querySelector(".tm-drag");
    if (dragHandle) {
      dragHandle.style.cursor = "not-allowed";
      dragHandle.style.opacity = "0.5";
      dragHandle.style.pointerEvents = "none";
    }
    row.draggable = false;
    autosizeTextarea(input);
    input.focus();
    input.select();
    const handleSave = async () => {
      const val = String(input.value || "").trim();
      if (val.length === 0) {
        return;
      }
      input.disabled = true;
      row.style.border = "1px solid #1976d2";
      const jiraKey = extractJiraKey(val);
      const dueDateData = extractDueDate(val);
      let jiraData = null;
      let taskText = val;
      if (jiraKey) {
        jiraData = await fetchJiraIssue(jiraKey);
        if (jiraData.error) {
          row.style.border = "2px solid #d32f2f";
          input.disabled = false;
          return;
        }
        taskText = taskText.replace(/\b[A-Z]+-\d+\b/, "").trim();
      }
      if (dueDateData) {
        taskText = taskText.replace(/@[a-zа-яё]+/i, "").trim();
      }
      const tasks = loadTasks();
      const idx = tasks.findIndex((x) => String(x.id) === String(task.id));
      if (idx !== -1) {
        tasks[idx].text = taskText;
        if (jiraKey) {
          if (jiraData && !jiraData.error) {
            tasks[idx].jiraKey = jiraData.key;
            tasks[idx].jiraSummary = jiraData.summary;
            tasks[idx].jiraUrl = jiraData.url;
          }
        } else if (!task.jiraKey) {
          delete tasks[idx].jiraKey;
          delete tasks[idx].jiraSummary;
          delete tasks[idx].jiraUrl;
        }
        if (dueDateData) {
          tasks[idx].dueDate = dueDateData.date;
          tasks[idx].dueDateLabel = dueDateData.label;
          tasks[idx].dueDateStart = dueDateData.startDate;
          tasks[idx].dueDateType = dueDateData.type;
        }
        saveTasks(tasks);
        const list2 = row.parentElement;
        if (list2) {
          rerenderList(list2, tasks, renderItem);
        }
      }
    };
    const handleCancel = () => {
      const list2 = row.parentElement;
      if (list2) {
        rerenderList(list2, loadTasks(), renderItem);
      }
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    });
  }

  // src/ui/index.js
  function sortTasksWithDoneAtEnd(tasks) {
    const notDone = tasks.filter((t) => !t.done);
    const done = tasks.filter((t) => t.done);
    return [...notDone, ...done];
  }
  function renderUI(root, initialTasks) {
    window.__tmRerenderList = rerenderList;
    window.__tmRenderItem = renderItem;
    let isSortedByDate = false;
    const form = el("div", { className: "tm-form" });
    form.style.display = "flex";
    form.style.gap = "8px";
    form.style.marginBottom = "10px";
    form.style.flexWrap = "wrap";
    const input = el("textarea", { placeholder: "\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u0434\u0430\u0447\u0430\u2026", id: "tm-input", rows: "1", wrap: "soft" });
    input.style.flex = "1";
    input.style.padding = "6px 8px";
    input.style.border = "1px solid #dcdcdc";
    input.style.borderRadius = "6px";
    input.style.resize = "none";
    input.style.overflow = "hidden";
    input.style.lineHeight = "1.4";
    const addBtn = el("button", { type: "button", id: "tm-add-btn", text: "\u27A4" });
    addBtn.style.padding = "6px 10px";
    addBtn.style.border = "1px solid #3572b0";
    addBtn.style.borderRadius = "6px";
    addBtn.style.background = "#4a9ae9";
    addBtn.style.color = "#fff";
    addBtn.style.cursor = "pointer";
    addBtn.style.height = "32px";
    addBtn.style.display = "inline-flex";
    addBtn.style.alignItems = "center";
    addBtn.style.justifyContent = "center";
    addBtn.style.flex = "0 0 auto";
    addBtn.style.alignSelf = "flex-start";
    form.appendChild(input);
    form.appendChild(addBtn);
    const hintAdd = el("div", { className: "tm-hint-add", text: "Enter \u2014 \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C, Shift+Enter \u2014 \u043D\u043E\u0432\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430" });
    hintAdd.style.fontSize = "12px";
    hintAdd.style.color = "#777";
    hintAdd.style.flexBasis = "100%";
    hintAdd.style.marginTop = "-4px";
    form.appendChild(hintAdd);
    autosizeTextarea(input);
    const sortBar = el("div", { className: "tm-sort-bar" });
    sortBar.style.display = "flex";
    sortBar.style.gap = "8px";
    sortBar.style.marginBottom = "10px";
    const sortByDateBtn = el("button", { type: "button", text: "\u21C5 \u041F\u043E \u0434\u0430\u0442\u0435" });
    sortByDateBtn.style.padding = "6px 12px";
    sortByDateBtn.style.borderRadius = "6px";
    sortByDateBtn.style.cursor = "pointer";
    sortByDateBtn.style.fontSize = "13px";
    sortByDateBtn.style.fontWeight = "400";
    sortByDateBtn.style.transition = "background 0.2s ease, border-color 0.2s ease, color 0.2s ease";
    const applyInactiveStyle = () => {
      sortByDateBtn.style.border = "1px solid #b0bec5";
      sortByDateBtn.style.background = "#eceff1";
      sortByDateBtn.style.color = "#607d8b";
    };
    const applyActiveStyle = () => {
      sortByDateBtn.style.border = "1px solid #90caf9";
      sortByDateBtn.style.background = "#e3f2fd";
      sortByDateBtn.style.color = "#1976d2";
    };
    const applyHoverStyle = () => {
      if (isSortedByDate) {
        sortByDateBtn.style.background = "#bbdefb";
      } else {
        sortByDateBtn.style.background = "#cfd8dc";
      }
    };
    const applyDefaultStyle = () => {
      if (isSortedByDate) {
        applyActiveStyle();
      } else {
        applyInactiveStyle();
      }
    };
    applyInactiveStyle();
    sortByDateBtn.addEventListener("mouseover", applyHoverStyle);
    sortByDateBtn.addEventListener("mouseout", applyDefaultStyle);
    sortBar.appendChild(sortByDateBtn);
    window.__tmDeactivateSortButton = () => {
      isSortedByDate = false;
      applyInactiveStyle();
    };
    const list = el("div", { id: "tm-list" });
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "6px";
    const sortedInitialTasks = sortTasksWithDoneAtEnd(initialTasks);
    sortedInitialTasks.forEach((t) => list.appendChild(renderItem(t)));
    root.appendChild(form);
    root.appendChild(sortBar);
    root.appendChild(list);
    sortByDateBtn.addEventListener("click", () => {
      const tasks = loadTasks();
      const notDoneTasks = tasks.filter((t) => !t.done);
      const doneTasks = tasks.filter((t) => t.done);
      const notDoneWithDate = notDoneTasks.filter((t) => t.dueDate);
      const notDoneWithoutDate = notDoneTasks.filter((t) => !t.dueDate);
      notDoneWithDate.sort((a, b) => {
        const dateA = new Date(a.dueDate);
        const dateB = new Date(b.dueDate);
        return dateA - dateB;
      });
      const sorted = [...notDoneWithDate, ...notDoneWithoutDate, ...doneTasks];
      saveTasks(sorted);
      rerenderList(list, sorted, renderItem);
      isSortedByDate = true;
      applyActiveStyle();
    });
    addBtn.addEventListener("click", async () => {
      const val = String(input.value || "").trim();
      if (!val) {
        return;
      }
      addBtn.disabled = true;
      addBtn.textContent = "\u23F3";
      input.style.border = "1px solid #dcdcdc";
      const jiraKey = extractJiraKey(val);
      const dueDateData = extractDueDate(val);
      let jiraData = null;
      let taskText = val;
      if (jiraKey) {
        jiraData = await fetchJiraIssue(jiraKey);
        if (jiraData.error) {
          input.style.border = "2px solid #d32f2f";
          addBtn.disabled = false;
          addBtn.textContent = "\u27A4";
          return;
        }
        taskText = taskText.replace(/\b[A-Z]+-\d+\b/, "").trim();
      }
      if (dueDateData) {
        taskText = taskText.replace(/@[a-zа-яё]+/i, "").trim();
      }
      const current = loadTasks();
      const newTask = { id: Date.now(), text: taskText, done: false, createdAt: Date.now() };
      if (jiraData && !jiraData.error) {
        newTask.jiraKey = jiraData.key;
        newTask.jiraSummary = jiraData.summary;
        newTask.jiraUrl = jiraData.url;
      }
      if (dueDateData) {
        newTask.dueDate = dueDateData.date;
        newTask.dueDateLabel = dueDateData.label;
        newTask.dueDateStart = dueDateData.startDate;
        newTask.dueDateType = dueDateData.type;
      }
      const next = [newTask, ...current];
      const sortedNext = sortTasksWithDoneAtEnd(next);
      saveTasks(sortedNext);
      input.value = "";
      input.dispatchEvent(new Event("input"));
      addBtn.disabled = false;
      addBtn.textContent = "\u27A4";
      rerenderList(list, sortedNext, renderItem);
      input.focus();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        addBtn.click();
      }
    });
  }

  // src/bootstrap.js
  var globalMenuCloserAttached = false;
  function setupGlobalMenuCloser() {
    if (globalMenuCloserAttached) {
      return;
    }
    document.addEventListener("click", (ev) => {
      const target = ev.target;
      if (!(target instanceof Node)) {
        return;
      }
      const wraps = document.querySelectorAll(".tm-menu-wrap");
      wraps.forEach((wrap) => {
        if (!wrap.contains(target)) {
          const menu = wrap.querySelector(".tm-item-menu");
          if (menu) {
            menu.style.display = "none";
          }
        }
      });
    });
    globalMenuCloserAttached = true;
  }
  function bootstrap(gadgetEl) {
    if (!gadgetEl) {
      return;
    }
    const headerEl = gadgetEl.querySelector(HEADER_SELECTOR);
    if (headerEl) {
      headerEl.textContent = "Jira Mini Tasks";
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
    const wrapper = el("div", { id: WRAPPER_ID });
    wrapper.style.padding = "12px 12px";
    wrapper.style.border = "1px solid #e5e5e5";
    wrapper.style.borderRadius = "8px";
    wrapper.style.background = "#fff";
    contentEl.appendChild(wrapper);
    const tasks = loadTasks();
    renderUI(wrapper, tasks);
    updateHeaderCounts(tasks);
    setupGlobalMenuCloser();
  }
  function main() {
    pollForGadget(bootstrap);
  }

  // src/jira-page-integration.js
  function getIssueKeyFromUrl() {
    const match = window.location.pathname.match(/\/browse\/([A-Z]+-\d+)/);
    return match ? match[1] : null;
  }
  function formatCreatedDate(timestamp) {
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  }
  function formatDateDisplay2(dateStr) {
    const date = new Date(dateStr);
    const months = ["\u044F\u043D\u0432\u0430\u0440\u044F", "\u0444\u0435\u0432\u0440\u0430\u043B\u044F", "\u043C\u0430\u0440\u0442\u0430", "\u0430\u043F\u0440\u0435\u043B\u044F", "\u043C\u0430\u044F", "\u0438\u044E\u043D\u044F", "\u0438\u044E\u043B\u044F", "\u0430\u0432\u0433\u0443\u0441\u0442\u0430", "\u0441\u0435\u043D\u0442\u044F\u0431\u0440\u044F", "\u043E\u043A\u0442\u044F\u0431\u0440\u044F", "\u043D\u043E\u044F\u0431\u0440\u044F", "\u0434\u0435\u043A\u0430\u0431\u0440\u044F"];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  }
  function isOverdue2(dateStr) {
    const now = /* @__PURE__ */ new Date();
    const due = new Date(dateStr);
    now.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return due < now;
  }
  function createTaskForm(issueKey, existingTask = null) {
    const formContainer = el("div", { id: "tm-jira-task-form" });
    formContainer.style.marginTop = "12px";
    formContainer.style.marginLeft = "20px";
    formContainer.style.marginBottom = "16px";
    formContainer.style.maxWidth = "900px";
    formContainer.style.padding = "12px 16px";
    formContainer.style.border = "1px solid #bbdefb";
    formContainer.style.borderRadius = "6px";
    formContainer.style.background = "#f5f9ff";
    formContainer.style.display = "flex";
    formContainer.style.flexDirection = "column";
    formContainer.style.gap = "10px";
    const titleDiv = el("div", { text: existingTask ? "\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443" : "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443" });
    titleDiv.style.fontSize = "13px";
    titleDiv.style.fontWeight = "600";
    titleDiv.style.color = "#1976d2";
    const textarea = el("textarea", {
      placeholder: "\u041E\u043F\u0438\u0448\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u0447\u0443... (\u043C\u043E\u0436\u043D\u043E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C @\u0441\u0435\u0433\u043E\u0434\u043D\u044F, @\u0437\u0430\u0432\u0442\u0440\u0430 \u0438 \u0442.\u0434.)",
      rows: "3",
      wrap: "soft"
    });
    textarea.value = existingTask ? existingTask.text : "";
    textarea.style.width = "100%";
    textarea.style.padding = "8px";
    textarea.style.border = "1px solid #dcdcdc";
    textarea.style.borderRadius = "6px";
    textarea.style.fontSize = "14px";
    textarea.style.lineHeight = "1.4";
    textarea.style.resize = "vertical";
    textarea.style.fontFamily = "inherit";
    textarea.style.boxSizing = "border-box";
    const buttonsDiv = el("div");
    buttonsDiv.style.display = "flex";
    buttonsDiv.style.gap = "8px";
    buttonsDiv.style.alignItems = "center";
    const saveBtn = el("button", { type: "button", text: existingTask ? "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C" : "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C" });
    saveBtn.style.padding = "6px 16px";
    saveBtn.style.border = "1px solid #3572b0";
    saveBtn.style.borderRadius = "6px";
    saveBtn.style.background = "#4a9ae9";
    saveBtn.style.color = "#fff";
    saveBtn.style.cursor = "pointer";
    saveBtn.style.fontSize = "14px";
    saveBtn.style.fontWeight = "500";
    const cancelBtn = el("button", { type: "button", text: "\u041E\u0442\u043C\u0435\u043D\u0430" });
    cancelBtn.style.padding = "6px 16px";
    cancelBtn.style.border = "1px solid #ccc";
    cancelBtn.style.borderRadius = "6px";
    cancelBtn.style.background = "#fff";
    cancelBtn.style.color = "#666";
    cancelBtn.style.cursor = "pointer";
    cancelBtn.style.fontSize = "14px";
    const hintDiv = el("div", { text: "Enter \u2014 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C, Shift+Enter \u2014 \u043D\u043E\u0432\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430, Esc \u2014 \u043E\u0442\u043C\u0435\u043D\u0430" });
    hintDiv.style.fontSize = "12px";
    hintDiv.style.color = "#777";
    hintDiv.style.marginLeft = "auto";
    buttonsDiv.appendChild(saveBtn);
    buttonsDiv.appendChild(cancelBtn);
    buttonsDiv.appendChild(hintDiv);
    formContainer.appendChild(titleDiv);
    formContainer.appendChild(textarea);
    formContainer.appendChild(buttonsDiv);
    autosizeTextarea(textarea);
    const handleSave = async () => {
      const val = String(textarea.value || "").trim();
      if (!val) {
        return;
      }
      saveBtn.disabled = true;
      cancelBtn.disabled = true;
      textarea.disabled = true;
      saveBtn.textContent = "\u23F3";
      formContainer.style.border = "1px solid #bbdefb";
      const dueDateData = extractDueDate(val);
      let taskText = val;
      if (dueDateData) {
        taskText = taskText.replace(/@[a-zа-яё]+/i, "").trim();
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
        const jiraSummary = document.querySelector("#summary-val")?.textContent || "";
        const newTask = {
          id: Date.now(),
          text: taskText,
          done: false,
          createdAt: Date.now(),
          jiraKey: issueKey,
          jiraSummary,
          jiraUrl: `https://jira.theteamsoft.com/browse/${issueKey}`
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
      refreshTaskDisplay();
    };
    const handleCancel = () => {
      refreshTaskDisplay();
    };
    saveBtn.addEventListener("click", handleSave);
    cancelBtn.addEventListener("click", handleCancel);
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    });
    return formContainer;
  }
  function createTaskDisplay(task) {
    const infoBlock = el("div", { id: "tm-jira-task-info" });
    infoBlock.style.marginTop = "12px";
    infoBlock.style.marginLeft = "20px";
    infoBlock.style.marginBottom = "16px";
    infoBlock.style.maxWidth = "900px";
    infoBlock.style.padding = "12px 16px";
    infoBlock.style.border = "1px solid #e3f2fd";
    infoBlock.style.borderRadius = "6px";
    infoBlock.style.background = "#f5f9ff";
    infoBlock.style.display = "flex";
    infoBlock.style.flexDirection = "column";
    infoBlock.style.gap = "6px";
    infoBlock.style.cursor = "pointer";
    infoBlock.style.transition = "background 0.2s ease, border-color 0.2s ease";
    infoBlock.title = "\u041D\u0430\u0436\u043C\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u0440\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C";
    const titleDiv = el("div", { text: "\u0417\u0430\u0434\u0430\u0447\u0430" });
    titleDiv.style.fontSize = "13px";
    titleDiv.style.fontWeight = "600";
    titleDiv.style.color = "#1976d2";
    const textDiv = el("div");
    textDiv.style.fontSize = "14px";
    textDiv.style.color = "#424242";
    textDiv.style.lineHeight = "1.4";
    textDiv.style.whiteSpace = "pre-wrap";
    textDiv.textContent = task.text || "(\u0442\u0435\u043A\u0441\u0442 \u0437\u0430\u0434\u0430\u0447\u0438 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442)";
    let dueDateDiv = null;
    if (task.dueDateLabel && task.dueDate) {
      const overdue = isOverdue2(task.dueDate);
      const dateText = overdue ? formatDateDisplay2(task.dueDate) : task.dueDateLabel;
      dueDateDiv = el("div");
      dueDateDiv.style.fontSize = "12px";
      dueDateDiv.style.color = overdue ? "#c62828" : "#1976d2";
      dueDateDiv.style.fontWeight = "500";
      dueDateDiv.textContent = `\uFF20 ${dateText}`;
    }
    const timeDiv = el("div");
    timeDiv.style.fontSize = "12px";
    timeDiv.style.color = "#777";
    timeDiv.textContent = `\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E: ${formatCreatedDate(task.createdAt)}`;
    infoBlock.appendChild(titleDiv);
    infoBlock.appendChild(textDiv);
    if (dueDateDiv) {
      infoBlock.appendChild(dueDateDiv);
    }
    infoBlock.appendChild(timeDiv);
    infoBlock.addEventListener("mouseenter", () => {
      infoBlock.style.background = "#e3f2fd";
      infoBlock.style.borderColor = "#90caf9";
    });
    infoBlock.addEventListener("mouseleave", () => {
      infoBlock.style.background = "#f5f9ff";
      infoBlock.style.borderColor = "#e3f2fd";
    });
    infoBlock.addEventListener("click", () => {
      const issueKey = getIssueKeyFromUrl();
      if (issueKey) {
        showTaskForm(issueKey, task);
      }
    });
    return infoBlock;
  }
  function createAddTaskButton(issueKey) {
    const button = el("button", { type: "button", text: "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443", id: "tm-jira-add-task" });
    button.style.marginTop = "12px";
    button.style.marginLeft = "20px";
    button.style.marginBottom = "16px";
    button.style.padding = "10px 16px";
    button.style.border = "1px solid #3572b0";
    button.style.borderRadius = "6px";
    button.style.background = "#4a9ae9";
    button.style.color = "#fff";
    button.style.cursor = "pointer";
    button.style.fontSize = "14px";
    button.style.fontWeight = "500";
    button.style.transition = "background 0.2s ease";
    button.addEventListener("mouseenter", () => {
      button.style.background = "#357abd";
    });
    button.addEventListener("mouseleave", () => {
      button.style.background = "#4a9ae9";
    });
    button.addEventListener("click", () => {
      showTaskForm(issueKey);
    });
    return button;
  }
  function showTaskForm(issueKey, existingTask = null) {
    const oldBlock = document.querySelector("#tm-jira-task-info");
    const oldForm = document.querySelector("#tm-jira-task-form");
    const oldButton = document.querySelector("#tm-jira-add-task");
    if (oldBlock) oldBlock.remove();
    if (oldForm) oldForm.remove();
    if (oldButton) oldButton.remove();
    const form = createTaskForm(issueKey, existingTask);
    const stalker = document.querySelector("#stalker");
    const pageHeader = stalker ? stalker.querySelector(".aui-page-header") : document.querySelector(".aui-page-header");
    if (pageHeader && pageHeader.parentNode) {
      pageHeader.parentNode.insertBefore(form, pageHeader.nextSibling);
      const textarea = form.querySelector("textarea");
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
  function refreshTaskDisplay() {
    const issueKey = getIssueKeyFromUrl();
    if (!issueKey) {
      return;
    }
    const oldBlock = document.querySelector("#tm-jira-task-info");
    const oldForm = document.querySelector("#tm-jira-task-form");
    const oldButton = document.querySelector("#tm-jira-add-task");
    if (oldBlock) oldBlock.remove();
    if (oldForm) oldForm.remove();
    if (oldButton) oldButton.remove();
    const tasks = loadTasks();
    const task = tasks.find((t) => t.jiraKey === issueKey);
    const stalker = document.querySelector("#stalker");
    const pageHeader = stalker ? stalker.querySelector(".aui-page-header") : document.querySelector(".aui-page-header");
    if (!pageHeader || !pageHeader.parentNode) {
      return;
    }
    if (task) {
      const display = createTaskDisplay(task);
      pageHeader.parentNode.insertBefore(display, pageHeader.nextSibling);
    } else {
      const button = createAddTaskButton(issueKey);
      pageHeader.parentNode.insertBefore(button, pageHeader.nextSibling);
    }
  }
  function injectTaskInfo() {
    const issueKey = getIssueKeyFromUrl();
    if (!issueKey) {
      return;
    }
    const stalker = document.querySelector("#stalker");
    const pageHeader = stalker ? stalker.querySelector(".aui-page-header") : document.querySelector(".aui-page-header");
    if (!pageHeader) {
      return;
    }
    if (document.querySelector("#tm-jira-task-info") || document.querySelector("#tm-jira-task-form") || document.querySelector("#tm-jira-add-task")) {
      return;
    }
    refreshTaskDisplay();
  }
  function initJiraPageIntegration() {
    injectTaskInfo();
    const observer = new MutationObserver(() => {
      injectTaskInfo();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        const oldBlock = document.querySelector("#tm-jira-task-info");
        const oldForm = document.querySelector("#tm-jira-task-form");
        const oldButton = document.querySelector("#tm-jira-add-task");
        if (oldBlock) oldBlock.remove();
        if (oldForm) oldForm.remove();
        if (oldButton) oldButton.remove();
        setTimeout(injectTaskInfo, 100);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  // src/index.js
  var currentPath = window.location.pathname;
  var isIssuePage = /^\/browse\/[A-Z]+-\d+/.test(currentPath);
  if (isIssuePage) {
    initJiraPageIntegration();
  } else if (currentPath.startsWith("/secure/")) {
    main();
  }
})();
