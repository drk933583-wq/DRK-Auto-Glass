// Wizard controller + steps 4-6 (service method, customer info, review). Order submission is Phase 6.
import { supabase } from './supabase.js';
import { h } from './components.js';
import { vehicleStep } from './vehicles.js';
import { buildMessage, waUrl, cleanPhone } from './whatsapp.js';
import { specsStep, glassStep, label, posLabel, specLabel } from './glass-selector.js';

export const newState = () => ({
  token: crypto.randomUUID(),          // idempotency key: a retry of the same order never creates a duplicate
  vehicle: {}, vin: '', specs: {}, origin: '', photo: null, positions: new Set(), glassUnknown: false, otherNote: '',
  service: { method: '', branch_id: '', branch_label: '', address: '' }, customer: { name: '', phone: '', phone2: '', address: '', notes: '' },
});
export const PHONE_RE = /^\+?[0-9]{10,15}$/;
export { cleanPhone };
const field = (lab, ...els) => h('label', { class: 'wz-field' }, h('span', {}, lab), ...els);

function serviceStep(box, state, cat) {
  const s = state.service, area = h('div', {});
  const radio = (val, text, disabled) => { const r = h('input', { type: 'radio', name: 'svc', value: val, checked: (s.method || 'unspecified') === val, disabled });
    r.addEventListener('change', () => { s.method = val; draw(); }); return h('label', { class: 'wz-card' + (disabled ? ' is-off' : '') }, r, h('span', {}, text)); };
  function draw() {
    if (s.method === 'branch') {
      const list = h('div', { class: 'wz-branches' }), safe = u => /^https:\/\//.test(u || '');
      const q = h('input', { type: 'search', placeholder: 'ابحث عن فرع…', 'aria-label': 'بحث عن فرع' });
      const drawList = () => {
        const t = q.value.trim().toLowerCase(), items = cat.branches.filter(b => !t || (b.name + ' ' + (b.address || '')).toLowerCase().includes(t));
        list.replaceChildren(...(items.length ? items.map(b => {
          const r = h('input', { type: 'radio', name: 'branch', value: b.id, checked: s.branch_id === b.id });
          r.addEventListener('change', () => { s.branch_id = b.id; s.branch_label = b.name + (b.address ? ' – ' + b.address : ''); s.branch_map = safe(b.map_url) ? b.map_url : ''; });
          return h('label', { class: 'wz-card' }, r, h('span', {}, h('strong', {}, b.name), b.address ? h('small', {}, b.address) : null,
            safe(b.map_url) ? h('a', { class: 'wz-link', href: b.map_url, target: '_blank', rel: 'noopener noreferrer' }, 'عرض الموقع على الخريطة') : null)); })
          : [h('p', { class: 'wz-note' }, 'لا توجد فروع مطابقة.')]));
      };
      q.addEventListener('input', drawList); drawList();
      area.replaceChildren(q, list);
    } else if (s.method === 'mobile') {
      const a = h('textarea', { rows: 3, maxlength: 300, placeholder: 'العنوان بالتفصيل' }, s.address || ''); a.addEventListener('input', () => { s.address = a.value; });
      area.replaceChildren(field('عنوانك (اختياري)', a), h('p', { class: 'wz-note' }, 'توفر الخدمة المتنقلة في منطقتك يؤكده فريق المبيعات، وليس مضمونًا تلقائيًا.'));
    } else area.replaceChildren();
  }
  box.replaceChildren(h('h3', {}, 'كيف تفضّل الحصول على الخدمة؟'),
    h('div', { class: 'wz-branches' }, radio('branch', 'التوجه إلى فرع DR. KHALED', !cat.branches.length), radio('mobile', 'استبدال متنقل في موقعي (إن توفر)', false), radio('unspecified', 'لم أحدد بعد / لا أعلم', false)),
    !cat.branches.length ? h('p', { class: 'wz-note' }, 'لا توجد فروع متاحة حاليًا.') : null, area);
  draw();
  return { validate: () => null };   // service method / branch / address are all optional
}

function customerStep(box, state) {
  const c = state.customer, bind = (key, attrs) => { const i = h(attrs.rows ? 'textarea' : 'input', { ...attrs, ...(attrs.rows ? {} : { value: c[key] || '' }) }, attrs.rows ? c[key] || '' : null);
    i.addEventListener('input', () => { c[key] = i.value; }); return i; };
  box.replaceChildren(h('h3', {}, 'بيانات التواصل'),
    h('div', { class: 'wz-grid' }, field('الاسم الكامل *', bind('name', { type: 'text', maxlength: 100, autocomplete: 'name' })),
      field('رقم الموبايل الأساسي *', bind('phone', { type: 'tel', dir: 'ltr', inputmode: 'tel', autocomplete: 'tel', placeholder: '01XXXXXXXXX' })),
      field('رقم إضافي (اختياري)', bind('phone2', { type: 'tel', dir: 'ltr', inputmode: 'tel' })),
      state.service.method === 'branch' ? field('العنوان (اختياري)', bind('address', { type: 'text', maxlength: 300 })) : null),
    field('ملاحظات إضافية (اختياري)', bind('notes', { rows: 3, maxlength: 1000 })),
    h('p', { class: 'wz-note wz-privacy' }, 'نستخدم بياناتك فقط للتواصل معك بخصوص هذا الطلب (التحقق من التوافق والسعر والموعد)، ولا نطلب أي بيانات غير لازمة.'));
  return { validate() {
    if ((c.name || '').trim().length < 2) return 'اكتب اسمك الكامل.';
    if (!PHONE_RE.test(cleanPhone(c.phone))) return 'رقم الموبايل غير صحيح (من 10 إلى 15 رقمًا).';
    if (c.phone2 && !PHONE_RE.test(cleanPhone(c.phone2))) return 'الرقم الإضافي غير صحيح.';
    return null; } };
}

export function vehicleLabel(state) {
  const v = state.vehicle;
  if (v.manual) return ([v.mbrand, v.mmodel, v.myear].filter(Boolean).join(' ') || 'لا أعلم') + ' (تحقق يدوي)';
  const parts = [v.brand?.label, v.model?.label, v.generation?.label, v.year, v.variant?.label].filter(Boolean);
  return parts.length ? parts.join(' / ') : 'لا أعلم';
}
export function serviceLabel(s) {
  return s.method === 'branch' ? `فرع: ${s.branch_label || 'لم يُحدَّد'}` : s.method === 'mobile' ? `خدمة متنقلة${(s.address || '').trim() ? ': ' + s.address.trim() : ''}` : 'لم تُحدَّد بعد';
}
/** Human-readable summary used by the review step. Unknown / skipped answers are shown as "لا أعلم". */
export function summaryRows(state, cat) {
  const rows = [['السيارة', vehicleLabel(state), 0]];
  if (state.vin) rows.push(['رقم الشاسيه', state.vin, 0]);
  const specs = cat.specs.filter(s => s.code !== 'origin').map(s => `${specLabel(s)}: ${state.specs[s.code] ? label(state.specs[s.code]) : 'لم يُحدَّد'}`);
  rows.push(['المواصفات', specs.length ? specs : 'لا توجد', 1]);
  rows.push(['مصدر الزجاج', state.origin ? label(state.origin) : 'لم يُحدَّد', 1]);
  if (state.photo) rows.push(['صورة مرفقة', state.photo.name + ' (يصل رابطها في رسالة واتساب)', 1]);
  const pos = cat.positions.filter(p => state.positions.has(p.id)).map(p => posLabel(p) + (p.code === 'other' && (state.otherNote || '').trim() ? `: ${state.otherNote.trim()}` : ''));
  rows.push(['الزجاج المطلوب', pos.length ? pos : 'لا أعلم (سيساعدك فريق المبيعات)', 2]);
  rows.push(['طريقة الخدمة', serviceLabel(state.service), 3]);
  const c = state.customer;
  rows.push(['العميل', [c.name.trim(), cleanPhone(c.phone), c.phone2 ? 'إضافي: ' + cleanPhone(c.phone2) : null, state.service.method === 'branch' ? c.address : null].filter(Boolean), 4]);
  if (c.notes) rows.push(['ملاحظات', c.notes, 4]);
  return rows;
}

function reviewStep(box, state, cat, goTo) {
  const dl = h('dl', { class: 'wz-sum' }, summaryRows(state, cat).flatMap(([t, val, step]) => [
    h('dt', {}, t, h('button', { type: 'button', class: 'wz-link', onclick: () => goTo(step) }, 'تعديل')),
    h('dd', {}, Array.isArray(val) ? h('ul', {}, val.map(x => h('li', {}, x))) : val)]));
  const submit = h('button', { type: 'button', class: 'btn btn--primary' }, 'تأكيد وإرسال الطلب');
  submit.addEventListener('click', () => state.onSubmit?.(submit));     // pressing this button IS the confirmation
  box.replaceChildren(h('h3', {}, 'مراجعة الطلب'), dl, submit,
    h('p', { class: 'wz-note' }, 'لن يتم إرسال أي شيء قبل ضغطك على "تأكيد وإرسال الطلب". سنستخدم بياناتك فقط للتواصل معك بخصوص هذا الطلب.'));
  return { validate: () => null };
}

const STEPS = [['vehicle', 'السيارة', vehicleStep], ['specs', 'المواصفات', specsStep], ['glass', 'الزجاج', glassStep],
  ['service', 'الخدمة', serviceStep], ['customer', 'بياناتك', customerStep], ['review', 'المراجعة', reviewStep]];

export async function initWizard(root, settings = {}) {
  const q = t => supabase.from(t).select('*').eq('is_active', true).order('display_order');
  const cat = {};
  root.replaceChildren(h('p', { class: 'muted' }, 'جارٍ التحميل…'));
  try {
    const [p, s, b] = await Promise.all([q('glass_positions'), q('glass_specifications'), q('branches')]);
    for (const r of [p, s, b]) if (r.error) throw r.error;
    cat.positions = p.data; cat.specs = s.data; cat.branches = b.data;
  } catch (e) {
    console.error(e);
    root.replaceChildren(h('p', { class: 'wz-err' }, 'تعذّر تحميل بيانات الطلب.'), h('button', { class: 'btn', type: 'button', onclick: () => initWizard(root, settings) }, 'إعادة المحاولة'));
    return null;
  }
  const state = newState(); let cur = 0, step = null;
  const nav = h('ol', { class: 'wz-steps' }), body = h('div', { class: 'wz-body' }), err = h('p', { class: 'wz-err', role: 'alert' });
  const back = h('button', { type: 'button', class: 'btn btn--ghost' }, 'السابق'), next = h('button', { type: 'button', class: 'btn btn--primary' }, 'التالي');
  function go(i) {
    cur = i; err.textContent = '';
    nav.replaceChildren(...STEPS.map(([k, t], idx) => h('li', { class: idx === cur ? 'is-cur' : idx < cur ? 'is-done' : '', 'aria-current': idx === cur ? 'step' : null }, `${idx + 1}. ${t}`)));
    step = STEPS[cur][2](body, state, cat, go);
    back.hidden = cur === 0; next.hidden = cur === STEPS.length - 1;
    root.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }
  back.addEventListener('click', () => go(cur - 1));
  next.addEventListener('click', () => { const m = step.validate(); if (m) { err.textContent = m; return; } go(cur + 1); });
  root.replaceChildren(nav, body, err, h('div', { class: 'wz-nav' }, back, next));
  state.onSubmit = btn => submitOrder({ root, state, cat, settings, btn, err, restart: () => initWizard(root, settings) });
  go(0);
  return { state, cat, go, preselectBrand(id, name) { state.vehicle = { brand: { id, label: name } }; go(0); } };
}

// ===================== Order submission (Phase 6) =====================
const ERR = { invalid_name: 'الاسم غير صحيح.', invalid_phone: 'رقم الموبايل غير صحيح.', invalid_phone2: 'الرقم الإضافي غير صحيح.',
  invalid_service_method: 'طريقة الخدمة غير صحيحة.', invalid_positions: 'اختيار الزجاج غير صحيح.', invalid_branch: 'الفرع المختار لم يعد متاحًا. ارجع واختر فرعًا آخر.',
  address_required: 'العنوان مطلوب للخدمة المتنقلة.', invalid_year: 'سنة الصنع غير صحيحة.', invalid_vehicle: 'السيارة المختارة لم تعد متاحة. ارجع واختيرها مرة أخرى.', rate_limited: 'تم إرسال عدد كبير من الطلبات. حاول بعد قليل أو تواصل معنا مباشرة.', invalid_position: 'أحد مواضع الزجاج لم يعد متاحًا. ارجع وأعد الاختيار.' };
const errText = e => { const k = Object.keys(ERR).find(k => (e?.message || '').includes(k)); return k ? ERR[k]
  : 'تعذّر حفظ الطلب. تحقق من الاتصال بالإنترنت وأعد المحاولة. بياناتك ما زالت محفوظة هنا.'; };

export function buildPayload(state, cat, uploadPath) {
  const v = state.vehicle, s = state.service, c = state.customer, method = s.method || 'unspecified';
  const specs = {};
  for (const sp of cat.specs) if (sp.code !== 'origin' && state.specs[sp.code]) specs[sp.code] = { label: specLabel(sp), value: state.specs[sp.code] };
  const other = cat.positions.find(p => p.code === 'other'), manual = !!v.manual, yr = manual ? v.myear : v.year;
  return {
    vehicle: manual ? { manual: true, manual_text: [v.mbrand, v.mmodel, v.myear].filter(Boolean).join(' ').trim(), year: yr ? Number(yr) : null }
      : { manual: false, brand_id: v.brand?.id || null, model_id: v.model?.id || null, generation_id: v.generation?.id || null, variant_id: v.variant?.id || null, year: yr ? Number(yr) : null },
    specs, origin_preference: state.origin || null, service_method: method,
    branch_id: method === 'branch' ? (s.branch_id || null) : null,
    address: method === 'mobile' ? ((s.address || '').trim() || null) : ((c.address || '').trim() || null),
    customer: { name: c.name.trim(), phone: cleanPhone(c.phone), phone2: c.phone2 ? cleanPhone(c.phone2) : null, vin: state.vin || null, notes: (c.notes || '').trim() || null },
    positions: [...state.positions].map(id => ({ position_id: id, note: other && id === other.id ? (state.otherNote || '').trim() || null : null })),
    positions_unknown: !!state.glassUnknown || state.positions.size === 0,
    upload_path: uploadPath || null, client_token: state.token,
  };
}

async function uploadPhoto(state) {
  if (!state.photo) return null;
  if (state.uploadedFor === state.photo) return state.uploadedPath;           // retry: don't upload twice
  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[state.photo.type];
  const path = `orders/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('customer-uploads').upload(path, state.photo, { contentType: state.photo.type });
  if (error) throw Object.assign(new Error('photo_upload_failed'), { photo: true });
  state.uploadedPath = path; state.uploadedFor = state.photo; return path;
}

/** The order is saved in Supabase FIRST. WhatsApp is opened only after a successful save. */
async function submitOrder({ root, state, cat, settings, btn, err, restart }) {
  if (state.ref) return;                                                       // already saved: never create a duplicate
  btn.disabled = true; btn.textContent = 'جارٍ حفظ الطلب…'; err.textContent = '';
  try {
    const path = await uploadPhoto(state);
    const { data, error } = await supabase.rpc('create_order', { p: buildPayload(state, cat, path) });
    if (error) throw error;
    if (!data?.reference) throw new Error('no_reference');
    state.ref = data.reference;
    // WhatsApp links cannot attach files, so the photo travels as a link inside the message.
    const photoUrl = path ? supabase.storage.from('customer-uploads').getPublicUrl(path).data.publicUrl : null;
    const url = waUrl(settings.whatsapp_number, buildMessage(state.ref, state, cat, settings.company_name || 'DR. KHALED', photoUrl));
    root.replaceChildren(h('div', { class: 'wz-done', role: 'status' }, h('h3', {}, 'تم حفظ طلبك بنجاح'),
      h('p', {}, 'رقم الطلب: ', h('strong', { dir: 'ltr' }, state.ref)),
      url ? h('p', { class: 'wz-note' }, 'سنفتح واتساب برسالة جاهزة. اضغط "إرسال" داخل واتساب لإكمال التواصل مع فريق المبيعات. طلبك محفوظ لدينا حتى لو لم ترسل الرسالة.')
        : h('p', { class: 'wz-note' }, 'سيتواصل معك فريق المبيعات على رقم الموبايل الذي كتبته.'),
      url ? h('a', { class: 'btn btn--primary', href: url, rel: 'noopener' }, 'فتح واتساب') : null,
      h('button', { type: 'button', class: 'btn btn--ghost', onclick: restart }, 'طلب جديد')));
    if (url) setTimeout(() => { location.href = url; }, 1500);
  } catch (e) {
    console.error('Order submit failed:', e);
    err.textContent = e.photo ? 'تعذّر رفع الصورة. أعد المحاولة أو ارجع واحذفها.' : errText(e);   // data stays in `state`
    btn.disabled = false; btn.textContent = 'إعادة المحاولة';
  }
}
