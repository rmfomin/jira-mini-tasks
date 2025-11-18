/**
 * Очистка DOM-элемента: удаление всех детей
 */
export function empty(el) {
  if (!el) {
    return;
  }
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/**
 * Создание элемента с атрибутами и детьми
 */
export function el(tag, attrs = {}, children = []) {
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

/**
 * Автоподгон высоты textarea под содержимое (до 6 строк)
 */
export function autosizeTextarea(ta) {
  if (!ta) {
    return;
  }
  const maxLines = 6;
  const resize = () => {
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

    ta.style.height = `${contentNext}px`;
    ta.style.overflowY = contentRaw > maxContent ? 'auto' : 'hidden';
  };
  ta.addEventListener('input', resize);
  resize();
  requestAnimationFrame(resize);
  setTimeout(resize, 0);
}
