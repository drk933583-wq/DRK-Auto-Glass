// Small reusable UI helpers. All dynamic text goes through textContent / text nodes (no innerHTML).
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function setText(sel, text) { const el = $(sel); if (el && text) el.textContent = text; }
export function showBanner(msg, kind = 'info') {
  const b = $('#banner'); if (!b) return;
  b.textContent = msg; b.className = `banner banner--${kind}`; b.hidden = false;
}
export const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
};
