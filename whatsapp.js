// Builds the Arabic WhatsApp message + wa.me URL. WhatsApp only opens a draft: the customer must press Send.
// wa.me cannot attach files, so an uploaded photo is included as a link inside the message text.
import { label, posLabel, specLabel } from './glass-selector.js';

export const cleanPhone = s => (s || '').replace(/[\s-]/g, '');
const NA = 'غير متوفر', UNK = 'لا أعلم';

export function buildMessage(ref, state, cat, company = 'DR. KHALED', photoUrl = null) {
  const v = state.vehicle, s = state.service, c = state.customer, L = [];
  L.push(`طلب جديد – ${company}`, '', `رقم الطلب: ${ref}`, '', 'بيانات السيارة:');
  if (v.manual) L.push(`السيارة (تحقق يدوي): ${[v.mbrand, v.mmodel, v.myear].filter(Boolean).join(' ') || UNK}`);
  else {
    L.push(`الشركة: ${v.brand?.label || UNK}`, `الموديل: ${v.model?.label || UNK}`, `الجيل: ${v.generation?.label || UNK}`, `سنة الصنع: ${v.year || UNK}`);
    if (v.variant) L.push(`الفئة: ${v.variant.label}`);
  }
  if (state.vin) L.push(`رقم الشاسيه: ${state.vin}`);
  L.push('', 'المواصفات:');
  const specs = cat.specs.filter(x => x.code !== 'origin' && state.specs[x.code]);
  if (specs.length) specs.forEach(x => L.push(`${specLabel(x)}: ${label(state.specs[x.code])}`)); else L.push('لم تُحدَّد');
  L.push('', `نوع الزجاج: ${state.origin ? label(state.origin) : 'لم يُحدَّد'}`, '', 'الزجاج المطلوب:');
  const pos = cat.positions.filter(p => state.positions.has(p.id));
  if (pos.length) pos.forEach(p => L.push(`- ${posLabel(p)}${p.code === 'other' && (state.otherNote || '').trim() ? ': ' + state.otherNote.trim() : ''}`));
  else L.push(`- ${UNK}، أرجو مساعدتي في تحديد الزجاج المناسب`);
  if (photoUrl) L.push('', 'صورة الزجاج:', photoUrl);
  L.push('', 'طريقة الخدمة:',
    s.method === 'branch' ? `التوجه إلى فرع: ${s.branch_label || 'لم يُحدَّد'}`
    : s.method === 'mobile' ? `خدمة متنقلة – العنوان: ${(s.address || '').trim() || 'سيتم تحديده'}` : 'لم تُحدَّد بعد');
  L.push('', 'بيانات العميل:', `الاسم: ${c.name.trim()}`, `رقم الهاتف: ${cleanPhone(c.phone)}`, `رقم إضافي: ${c.phone2 ? cleanPhone(c.phone2) : NA}`);
  if (s.method === 'branch') L.push(`العنوان: ${c.address?.trim() || NA}`);
  L.push('', 'ملاحظات:'); if (c.notes?.trim()) L.push(c.notes.trim());
  L.push('يرجى التواصل لتأكيد التوافق والتوافر والسعر.');
  return L.join('\n');
}

/** number must be international format, digits only (no +, no spaces). Returns null if not configured/invalid. */
export const waUrl = (number, text) => /^[0-9]{8,15}$/.test(number || '') ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
