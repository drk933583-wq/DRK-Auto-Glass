import { loadSettings, supabase, publicUrl } from './supabase.js';
import { setText, showBanner, $, h } from './components.js';
import { initWizard } from './order.js';

let wizard = null;

async function renderBrands() {
  const box = $('#brands-grid'); if (!box || !supabase) return;
  const { data, error } = await supabase.from('brands').select('id,name,name_ar,logo_path').eq('is_active', true).order('display_order').order('name').limit(12);
  if (error) { console.error(error); box.textContent = 'تعذّر تحميل الماركات.'; return; }
  if (!data.length) { box.textContent = 'لم تُضف ماركات بعد.'; return; }
  box.className = 'brand-grid';
  box.replaceChildren(...data.map(b => h('button', { type: 'button', class: 'brand-tile', onclick: () => { wizard?.preselectBrand(b.id, b.name); $('#start')?.scrollIntoView({ behavior: 'smooth' }); } },
    b.logo_path ? h('img', { src: publicUrl('brand-logos', b.logo_path), alt: '', loading: 'lazy' }) : null, h('span', {}, b.name_ar || b.name))));
}

function renderContact(s) {
  const box = $('#contact-info'), rows = [];
  if (s.contact_phone) rows.push(h('p', {}, 'هاتف: ', h('a', { href: 'tel:' + s.contact_phone, dir: 'ltr' }, s.contact_phone)));
  if (/^[0-9]{8,15}$/.test(s.whatsapp_number || '')) rows.push(h('p', {}, h('a', { class: 'btn btn--primary', href: 'https://wa.me/' + s.whatsapp_number, rel: 'noopener' }, 'تواصل عبر واتساب')));
  if (s.email) rows.push(h('p', {}, 'البريد: ', h('a', { href: 'mailto:' + s.email }, s.email)));
  if (s.address) rows.push(h('p', {}, 'العنوان: ' + s.address));
  box.className = ''; box.replaceChildren(...(rows.length ? rows : [h('p', { class: 'muted' }, 'سيتم إضافة بيانات التواصل قريبًا.')]));
}

async function init() {
  const wz = $('#wizard');
  try {
    const s = await loadSettings();                     // all homepage text comes from the database
    for (const k of ['company_name', 'welcome_title', 'welcome_text', 'cta_label', 'footer_text']) setText(`[data-s="${k}"]`, s[k]);
    if (s.company_name) document.title = s.company_name + ' – زجاج السيارات';
    if (s.logo_path) $('.brand')?.prepend(h('img', { class: 'brand__logo', src: publicUrl('website-assets', s.logo_path), alt: '' }));
    if (s.services_text) { const sv = $('#services-list'); sv.className = 'prewrap'; sv.textContent = s.services_text; }
    if (s.privacy_policy) { const p = $('#privacy'); p.hidden = false; $('#privacy-text').textContent = s.privacy_policy; }
    renderContact(s);
    if (s.site_available === false) { showBanner('الموقع غير متاح حاليًا.', 'warn'); wz.textContent = 'استقبال الطلبات متوقف مؤقتًا.'; }
    else wizard = await initWizard(wz, s);
    await renderBrands();
  } catch (e) {
    console.error('Init failed:', e);
    showBanner('تعذّر تحميل بيانات الموقع. تأكد من إعداد Supabase.', 'error');
    wz.textContent = 'الخدمة غير متاحة حاليًا.';
  }
  $('#start-btn')?.addEventListener('click', () => $('#start')?.scrollIntoView({ behavior: 'smooth' }));
}
init();
