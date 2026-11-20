// Builds the Arabic WhatsApp message + wa.me URL. WhatsApp only opens a draft: the customer must press Send.
import { label, posLabel, specLabel } from './glass-selector.js';

export const cleanPhone = s => (s || '').replace(/[\s-]/g, '');
const NA = 'غير متوفر';

export function buildMessage(ref, state, cat, company = 'DR. KHALED') {
  const v = state.vehicle, s = state.service, c = state.customer, L = [];
  L.push(`طلب جديد – ${company}`, '', `رقم الطلب: ${ref}`, '', 'بيانات السيارة:');
  if (v.manual) L.push(`السيارة (تحقق يدوي): ${[v.mbrand, v.mmodel, v.myear].filter(Boolean).join(' ')}`);
  else {
    L.push(`الشركة: ${v.brand.label}`, `الموديل: ${v.model.label}`, `الجيل: ${v.generation.label}`, `سنة الصنع: ${v.year}`);
    if (v.variant) L.push(`الفئة: ${v.variant.label}`);
  }
  if (state.vin) L.push(`رقم الشاسيه: ${state.vin}`);
  L.push('', 'المواصفات:');
  const specs = cat.specs.filter(x => x.code !== 'origin' && state.specs[x.code]);
  if (specs.length) specs.forEach(x => L.push(`${specLabel(x)}: ${label(state.specs[x.code])}`)); else L.push('لم تُحدَّد');
  L.push('', `نوع الزجاج: ${state.origin ? label(state.origin) : 'لم يُحدَّد'}`, '', 'الزجاج المطلوب:');
  cat.positions.filter(p => state.positions.has(p.id)).forEach(p => L.push(`- ${posLabel(p)}${p.code === 'other' && state.otherNote ? ': ' + state.otherNote.trim() : ''}`));
  L.push('', 'طريقة الخدمة:', s.method === 'branch' ? `التوجه إلى فرع: ${s.branch_label}` : `خدمة متنقلة – العنوان: ${s.address.trim()}`);
  L.push('', 'بيانات العميل:', `الاسم: ${c.name.trim()}`, `رقم الهاتف: ${cleanPhone(c.phone)}`, `رقم إضافي: ${c.phone2 ? cleanPhone(c.phone2) : NA}`);
  if (s.method === 'branch') L.push(`العنوان: ${c.address?.trim() || NA}`);
  L.push('', 'ملاحظات:'); if (c.notes?.trim()) L.push(c.notes.trim());
  L.push('يرجى التواصل لتأكيد التوافق والتوافر والسعر.');
  return L.join('\n');
}

/** number must be international format, digits only (no +, no spaces). Returns null if not configured/invalid. */
export const waUrl = (number, text) => /^[0-9]{8,15}$/.test(number || '') ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
