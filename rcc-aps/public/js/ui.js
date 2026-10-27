// ── MODAL HELPERS ─────────────────────────────────────────────
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('show');
  el.style.display = '';
}

// HTML-escape a dynamic value before interpolating it into innerHTML.
// Prevents user-entered names/emails/departments from injecting markup.
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}
document.querySelectorAll('.modal-overlay').forEach(o=>{
  o.addEventListener('click', e=>{
    if (e.target === o) {
      // Non-dismissable modals stay open until the user acts intentionally.
      if (o.id === 'bonusDateModal' || o.id === 'endDatePromptModal') return;
      o.classList.remove('show');
      o.style.display = '';
    }
  });
});

// ── TOAST ─────────────────────────────────────────────────────
function showToast(icon, msg) {
  const t=document.getElementById('toast');
  document.getElementById('toastIcon').textContent=icon;
  document.getElementById('toastMsg').textContent=msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3500);
}

// ── RESPONSIVE SIDEBAR DRAWER ────────────────────────────────
// Sidebar collapses into an off-canvas drawer below 1024px.
function toggleSidebar(pageId) {
  const page = document.getElementById(pageId);
  if (!page) return;
  const open = page.classList.toggle('sb-open');
  const backdrop = document.getElementById('sbBackdrop');
  if (backdrop) backdrop.classList.toggle('show', open);
}
function closeSidebar() {
  document.querySelectorAll('.dashboard-page').forEach(p=>p.classList.remove('sb-open'));
  const backdrop = document.getElementById('sbBackdrop');
  if (backdrop) backdrop.classList.remove('show');
}

// ── RESPONSIVE TABLES ─────────────────────────────────────────
// On mobile the CSS renders every <table> as stacked cards using
// td::before{content:attr(data-label)}. Here we stamp each cell with
// its column header so those labels always exist (desktop, mobile,
// and for tables built later by JS — tracked via MutationObserver).
let tableLabelTimer = null;
function stampTableLabels() {
  tableLabelTimer = null;
  document.querySelectorAll('table:not(.ps-pay-table)').forEach(tbl => {
    const heads = Array.from(tbl.querySelectorAll('thead th'))
      .map(th => th.textContent.replace(/\s+/g, ' ').trim());
    tbl.querySelectorAll('tbody tr').forEach(tr => {
      let col = 0;
      Array.from(tr.children).forEach(td => {
        if (td.colSpan > 1) { td.dataset.label = ''; col += td.colSpan; return; }
        td.dataset.label = heads[col] || '';
        col += td.colSpan || 1;
      });
    });
  });
}
function setupResponsiveTables() {
  stampTableLabels();
  const mo = new MutationObserver(() => {
    if (tableLabelTimer) return;
    tableLabelTimer = requestAnimationFrame(stampTableLabels);
  });
  mo.observe(document.body, { childList: true, subtree: true });
}
document.addEventListener('DOMContentLoaded', setupResponsiveTables);
