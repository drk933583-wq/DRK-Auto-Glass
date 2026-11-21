// Step 1 – cascading vehicle selection. Every list is loaded on demand from Supabase (nothing hardcoded).
import { supabase } from './supabase.js';
import { h } from './components.js';

const run = async q => { const { data, error } = await q; if (error) throw error; return data; };
const clean = s => (s || '').replace(/[%_,()\\]/g, ' ').trim();
const lbl = o => (o.name_ar && o.name_ar !== o.name ? `${o.name} – ${o.name_ar}` : o.name);

const loadBrands = s => { let q = supabase.from('brands').select('id,name,name_ar').eq('is_active', true).order('display_order').order('name').limit(100);
  if (clean(s)) q = q.ilike('name', `%${clean(s)}%`); return run(q); };
const loadModels = (brandId, s) => { let q = supabase.from('models').select('id,name,name_ar').eq('brand_id', brandId).eq('is_active', true).order('name').limit(100);
  if (clean(s)) q = q.ilike('name', `%${clean(s)}%`); return run(q); };
const loadGens = modelId => run(supabase.from('generations').select('id,name,code,start_year,end_year').eq('model_id', modelId).eq('is_active', true).order('start_year', { ascending: false }));
const loadVariants = genId => run(supabase.from('vehicle_variants').select('id,name,market').eq('generation_id', genId).eq('is_active', true).order('name'));

function fill(sel, items, labelFn, selectedId, placeholder) {
  sel.replaceChildren(h('option', { value: '' }, placeholder),
    ...items.map(i => h('option', { value: i.id, selected: i.id === selectedId }, labelFn(i))));
  sel.disabled = false;
}
const field = (label, ...els) => h('label', { class: 'wz-field' }, h('span', {}, label), ...els);
const optText = sel => sel.selectedOptions[0]?.textContent || '';

export function vehicleStep(box, state) {
  const v = state.vehicle, thisYear = new Date().getFullYear();
  const msg = h('p', { class: 'wz-note', role: 'status' });
  const brandQ = h('input', { type: 'search', placeholder: 'ابحث عن الماركة…', 'aria-label': 'بحث عن ماركة' });
  const brandSel = h('select', { 'aria-label': 'الماركة' });
  const modelQ = h('input', { type: 'search', placeholder: 'ابحث عن الموديل…', 'aria-label': 'بحث عن موديل' });
  const modelSel = h('select', { 'aria-label': 'الموديل', disabled: true });
  const genSel = h('select', { 'aria-label': 'الجيل', disabled: true });
  const yearBox = h('div', {});
  const varSel = h('select', { 'aria-label': 'الفئة' });
  const varWrap = field('الفئة / التجهيز (اختياري)', varSel); varWrap.hidden = true;
  let gens = [];
  const fail = (e, t) => { console.error(e); msg.textContent = t; };

  async function refreshBrands() { try { const it = await loadBrands(brandQ.value);
    if (v.brand && !it.some(i => i.id === v.brand.id)) it.unshift({ id: v.brand.id, name: v.brand.label });
    fill(brandSel, it, lbl, v.brand?.id, 'لا أعلم / اختر من القائمة'); msg.textContent = it.length ? '' : 'لا توجد نتائج.'; } catch (e) { fail(e, 'تعذّر تحميل الماركات.'); } }
  async function refreshModels() { if (!v.brand) { modelSel.disabled = true; return; }
    try { const it = await loadModels(v.brand.id, modelQ.value);
      if (v.model && !it.some(i => i.id === v.model.id)) it.unshift({ id: v.model.id, name: v.model.label });
      fill(modelSel, it, lbl, v.model?.id, 'لا أعلم / اختر من القائمة'); } catch (e) { fail(e, 'تعذّر تحميل الموديلات.'); } }
  async function refreshGens() { if (!v.model) { genSel.disabled = true; return; }
    try { gens = await loadGens(v.model.id);
      fill(genSel, gens, g => g.name + (g.start_year ? ` (${g.start_year}–${g.end_year ?? 'الآن'})` : ''), v.generation?.id, gens.length ? 'لا أعلم / اختر من القائمة' : 'لا توجد أجيال'); } catch (e) { fail(e, 'تعذّر تحميل الأجيال.'); } }
  async function refreshVariants() { varWrap.hidden = true; if (!v.generation) return;
    try { const it = await loadVariants(v.generation.id); if (it.length) { fill(varSel, it, o => o.name + (o.market ? ` (${o.market})` : ''), v.variant?.id, 'بدون تحديد'); varWrap.hidden = false; } }
    catch (e) { fail(e, 'تعذّر تحميل الفئات.'); } }
  function renderYear() {
    const g = v.generation, free = () => { const inp = h('input', { type: 'number', min: 1950, max: thisYear + 1, placeholder: 'لا أعلم (اختياري)', value: v.year || '', 'aria-label': 'سنة الصنع' });
      inp.addEventListener('input', () => { v.year = inp.value; }); return inp; };
    if (g && g.start != null) {
      const top = Math.min(g.end ?? thisYear, thisYear + 1), years = [];
      for (let y = top; y >= g.start && years.length < 80; y--) years.push(y);
      const sel = h('select', { 'aria-label': 'سنة الصنع' }, h('option', { value: '' }, 'لا أعلم'),
        years.map(y => h('option', { value: y, selected: String(y) === String(v.year) }, y)));
      sel.addEventListener('change', () => { v.year = sel.value; }); yearBox.replaceChildren(sel);
    } else yearBox.replaceChildren(free());      // no generation chosen: optional free-text year
  }
  let t1, t2;
  brandQ.addEventListener('input', () => { clearTimeout(t1); t1 = setTimeout(refreshBrands, 300); });
  modelQ.addEventListener('input', () => { clearTimeout(t2); t2 = setTimeout(refreshModels, 300); });
  brandSel.addEventListener('change', () => {           // changing brand resets everything below it
    v.brand = brandSel.value ? { id: brandSel.value, label: optText(brandSel) } : null;
    v.model = v.generation = v.variant = null; v.year = ''; modelQ.value = ''; modelSel.replaceChildren(); genSel.replaceChildren(); genSel.disabled = true;
    renderYear(); varWrap.hidden = true; refreshModels(); });
  modelSel.addEventListener('change', () => {            // changing model resets generation + year
    v.model = modelSel.value ? { id: modelSel.value, label: optText(modelSel) } : null;
    v.generation = v.variant = null; v.year = ''; genSel.replaceChildren(); renderYear(); varWrap.hidden = true; refreshGens(); });
  genSel.addEventListener('change', () => {
    const g = gens.find(x => x.id === genSel.value);
    v.generation = g ? { id: g.id, label: g.name, start: g.start_year, end: g.end_year } : null; v.variant = null; v.year = '';
    renderYear(); refreshVariants(); });
  varSel.addEventListener('change', () => { v.variant = varSel.value ? { id: varSel.value, label: optText(varSel) } : null; });

  const auto = h('div', { class: 'wz-grid' },
    field('الماركة', brandQ, brandSel), field('الموديل', modelQ, modelSel), field('الجيل', genSel), field('سنة الصنع', yearBox), varWrap);
  const mb = h('input', { type: 'text', value: v.mbrand || '', maxlength: 60 }), mm = h('input', { type: 'text', value: v.mmodel || '', maxlength: 60 }),
    my = h('input', { type: 'number', min: 1950, max: thisYear + 1, value: v.myear || '' });
  mb.addEventListener('input', () => { v.mbrand = mb.value; }); mm.addEventListener('input', () => { v.mmodel = mm.value; }); my.addEventListener('input', () => { v.myear = my.value; });
  const manual = h('div', { class: 'wz-grid' }, field('ماركة السيارة', mb), field('الموديل', mm), field('سنة الصنع (اختياري)', my),
    h('p', { class: 'wz-note' }, 'سيتواصل معك فريق المبيعات للتحقق من التوافق يدويًا. (كل الحقول اختيارية)'));
  const chk = h('input', { type: 'checkbox', id: 'wz-manual', checked: !!v.manual });
  const toggle = () => { auto.hidden = chk.checked; manual.hidden = !chk.checked; v.manual = chk.checked; };
  chk.addEventListener('change', toggle);
  const vin = h('input', { type: 'text', value: state.vin || '', maxlength: 40, dir: 'ltr', placeholder: 'اختياري' });
  vin.addEventListener('input', () => { state.vin = vin.value.trim(); });

  box.replaceChildren(h('h3', {}, 'اختر سيارتك'), h('p', { class: 'wz-note' }, 'كل الحقول اختيارية. لو مش عارف حاجة سيبها "لا أعلم" وفريقنا هيتأكد معاك.'), auto, manual,
    h('div', { class: 'wz-check' }, chk, h('label', { for: 'wz-manual' }, 'لم أجد سيارتي في القائمة (طلب تحقق يدوي)')),
    field('رقم الشاسيه VIN (اختياري)', vin), msg);
  toggle(); renderYear(); refreshBrands(); if (v.brand) { refreshModels(); if (v.model) { refreshGens().then(refreshVariants); } }

  // Nothing here is mandatory. Only malformed values (bad VIN / year) are rejected.
  return { validate() {
    if (state.vin && !/^[A-Za-z0-9]{5,40}$/.test(state.vin)) return 'رقم الشاسيه يحتوي على حروف وأرقام إنجليزية فقط (5 إلى 40).';
    const y = v.manual ? v.myear : v.year;
    if (y && (!/^\d{4}$/.test(String(y)) || Number(y) < 1950 || Number(y) > thisYear + 1)) return 'سنة الصنع غير صحيحة (4 أرقام).';
    return null; } };
}
