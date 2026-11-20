// Steps 2-3 – technical specifications and glass-position selection (checklist + synchronised SVG diagram).
import { supabase } from './supabase.js';
import { h } from './components.js';

export const LABELS = { yes: 'نعم', no: 'لا', not_sure: 'غير متأكد', egyptian: 'مصري', imported: 'مستورد', no_preference: 'لا يوجد تفضيل' };
export const label = c => LABELS[c] || c;
export const posLabel = p => p.label_ar || p.label_en || p.name;
export const specLabel = s => s.label_ar || s.label_en || s.code;

export function specsStep(box, state, cat) {
  const msg = h('p', { class: 'wz-note' }), posByCode = Object.fromEntries(cat.positions.map(p => [p.code, p]));
  const groups = cat.specs.map(s => {
    const cur = s.code === 'origin' ? state.origin : state.specs[s.code];
    const hint = s.applies_to?.length ? `ينطبق على: ${s.applies_to.map(c => posByCode[c] ? posLabel(posByCode[c]) : c).join('، ')}` : '';
    const opts = (Array.isArray(s.options) ? s.options : []).map(o => {
      const r = h('input', { type: 'radio', name: 'spec-' + s.code, value: o, checked: cur === o });
      r.addEventListener('change', () => { if (s.code === 'origin') state.origin = o; else state.specs[s.code] = o; });
      return h('label', { class: 'wz-radio' }, r, label(o)); });
    return h('fieldset', { class: 'wz-fs' }, h('legend', {}, specLabel(s)), hint ? h('small', { class: 'wz-note' }, hint) : null, h('div', { class: 'wz-opts' }, opts));
  });
  const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' });
  file.addEventListener('change', () => {
    const f = file.files[0]; msg.textContent = ''; state.photo = null; if (!f) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) { file.value = ''; return void (msg.textContent = 'نوع الصورة غير مسموح (PNG أو JPG أو WebP).'); }
    if (f.size > 5 * 1024 * 1024) { file.value = ''; return void (msg.textContent = 'حجم الصورة أكبر من 5MB.'); }
    state.photo = f; msg.textContent = 'تم اختيار: ' + f.name; });
  box.replaceChildren(h('h3', {}, 'المواصفات الفنية'), h('p', { class: 'wz-note' }, 'كل المواصفات اختيارية. إذا لم تكن متأكدًا اختر "غير متأكد".'),
    ...groups, h('label', { class: 'wz-field' }, h('span', {}, 'صورة للسيارة أو الزجاج الحالي (اختياري)'), file), msg);
  if (state.photo) msg.textContent = 'تم اختيار: ' + state.photo.name;
  return { validate: () => null };
}

// Top-view car diagram. Front of the car is at the top; "right/left" are the car's right/left as seen from above.
const ZONES = {
  front_windshield: { d: 'M66 100 L134 100 L126 66 L74 66 Z' }, rear_windshield: { d: 'M66 250 L134 250 L126 284 L74 284 Z' },
  panoramic_roof: { rect: [70, 108, 60, 100] },
  door_front_right: { rect: [136, 114, 16, 42] }, door_rear_right: { rect: [136, 160, 16, 42] }, quarter_front_right: { rect: [136, 96, 16, 14] }, quarter_rear_right: { rect: [136, 206, 16, 24] },
  door_front_left: { rect: [48, 114, 16, 42] }, door_rear_left: { rect: [48, 160, 16, 42] }, quarter_front_left: { rect: [48, 96, 16, 14] }, quarter_rear_left: { rect: [48, 206, 16, 24] },
};
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

export function glassStep(box, state, cat) {
  const sel = state.positions, byId = new Map(cat.positions.map(p => [p.id, p]));
  const counter = h('strong', {}), list = h('div', { class: 'wz-poslist' }), note = h('textarea', { rows: 2, maxlength: 300, placeholder: 'صف الزجاج الخاص المطلوب', value: '' }, state.otherNote || '');
  const noteWrap = h('label', { class: 'wz-field' }, h('span', {}, 'وصف الزجاج الآخر / الخاص *'), note);
  note.addEventListener('input', () => { state.otherNote = note.value; });
  const checks = new Map(), zones = new Map(); let confirmed = new Set();

  function sync() {
    counter.textContent = sel.size;
    for (const [id, c] of checks) c.checked = sel.has(id);
    for (const [id, z] of zones) { z.classList.toggle('is-on', sel.has(id)); z.setAttribute('aria-checked', String(sel.has(id))); }
    noteWrap.hidden = ![...sel].some(id => byId.get(id)?.code === 'other');
  }
  const toggle = id => { sel.has(id) ? sel.delete(id) : sel.add(id); sync(); };

  for (const p of cat.positions) {
    const c = h('input', { type: 'checkbox', id: 'pos-' + p.id }); c.addEventListener('change', () => toggle(p.id)); checks.set(p.id, c);
    list.append(h('label', { class: 'wz-pos', for: 'pos-' + p.id }, c, h('span', {}, posLabel(p)), h('em', { class: 'wz-badge', 'data-pos': p.id, hidden: true }, 'توافق مؤكد')));
  }
  const svg = svgEl('svg', { viewBox: '0 0 200 330', class: 'wz-car', role: 'group', 'aria-label': 'مخطط زجاج السيارة (اختياري)' });
  svg.append(svgEl('rect', { x: 40, y: 10, width: 120, height: 310, rx: 52, class: 'car-body' }));
  for (const p of cat.positions) {
    const def = ZONES[p.code]; if (!def) continue;
    const z = svgEl('g', { class: 'zone', tabindex: 0, role: 'checkbox', 'aria-label': posLabel(p), 'aria-checked': 'false' });
    z.append(def.d ? svgEl('path', { d: def.d }) : svgEl('rect', { x: def.rect[0], y: def.rect[1], width: def.rect[2], height: def.rect[3], rx: 3 }));
    const t = svgEl('title'); t.textContent = posLabel(p); z.append(t);
    z.addEventListener('click', () => toggle(p.id)); z.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(p.id); } });
    zones.set(p.id, z); svg.append(z);
  }
  const all = h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { cat.positions.forEach(p => sel.add(p.id)); sync(); } }, 'تحديد الكل');
  const none = h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { sel.clear(); sync(); } }, 'مسح التحديد');
  box.replaceChildren(h('h3', {}, 'اختر الزجاج المطلوب'),
    h('div', { class: 'wz-toolbar' }, all, none, h('span', {}, 'المحدد: ', counter)),
    h('div', { class: 'wz-glass' }, h('div', { class: 'wz-diagram', dir: 'ltr' }, svg), list), noteWrap,
    h('p', { class: 'wz-note' }, 'ليس كل الأوضاع متوفرة في كل السيارات. سيؤكد فريق المبيعات التوافق والتوافر.'));
  sync();

  // Mark positions that have verified public fitment for the chosen generation (informational only; all positions stay selectable).
  const g = state.vehicle.generation;
  if (!state.vehicle.manual && g) supabase.from('product_fitments').select('glass_position_id').eq('generation_id', g.id).limit(500)
    .then(({ data }) => { confirmed = new Set((data || []).map(r => r.glass_position_id));
      box.querySelectorAll('.wz-badge').forEach(b => { b.hidden = !confirmed.has(b.dataset.pos); }); });

  return { validate() {
    if (!sel.size) return 'اختر موضع زجاج واحدًا على الأقل.';
    if ([...sel].some(id => byId.get(id)?.code === 'other') && (state.otherNote || '').trim().length < 3) return 'اكتب وصف الزجاج الآخر / الخاص.';
    return null; } };
}
