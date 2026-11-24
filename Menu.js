// Mobile menu button: opens / closes the navigation panel. Standalone (works even if app.js / Supabase fail).
const header = document.querySelector('.site-header');
const btn = header?.querySelector('.menu-btn');
if (header && btn) {
  const set = open => { header.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open)); };
  btn.addEventListener('click', () => set(!header.classList.contains('is-open')));
  header.querySelectorAll('nav a').forEach(a => a.addEventListener('click', () => set(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  document.addEventListener('click', e => { if (!header.contains(e.target)) set(false); });
}
