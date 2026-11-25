/**
 * OFICINA DE ESTUDOS — Shared Utilities
 */

// ---- Validation ----
const Validate = {
  name(v) {
    return v && v.trim().length >= 3;
  },
  email(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v?.trim());
  },
  phone(v) {
    // Brazilian phone: 10–11 digits (with or without formatting)
    const digits = (v || '').replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 11;
  },
};

// ---- Phone formatting (BR) ----
function formatPhoneBR(value) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2)  return d;
  if (d.length <= 6)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

// ---- WhatsApp link ----
function buildWhatsAppLink(phone, message = '') {
  const digits = phone.replace(/\D/g, '');
  // Add Brazil country code if missing
  const international = digits.startsWith('55') ? digits : '55' + digits;
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${international}${encoded ? '?text=' + encoded : ''}`;
}

// ---- Date formatting ----
function formatDateBR(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatDateOnlyBR(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString('pt-BR');
}

// ---- Show / hide element ----
function show(el) { if (el) el.style.display = ''; }
function hide(el) { if (el) el.style.display = 'none'; }
function addClass(el, cls) { if (el) el.classList.add(cls); }
function removeClass(el, cls) { if (el) el.classList.remove(cls); }

// ---- Toast notification ----
let _toastTimer;
function showToast(message, type = 'info', duration = 4000) {
  let toast = document.getElementById('oe-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'oe-toast';
    toast.style.cssText = `
      position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;
      max-width:360px;padding:1rem 1.25rem;border-radius:10px;
      font-size:.9rem;font-weight:500;display:flex;align-items:center;
      gap:.6rem;box-shadow:0 8px 24px rgba(0,0,0,.18);
      transition:all .3s;opacity:0;transform:translateY(12px);
    `;
    document.body.appendChild(toast);
  }
  const colors = {
    success: { bg:'#f0fdf4', border:'#86efac', color:'#166534' },
    error:   { bg:'#fef2f2', border:'#fca5a5', color:'#991b1b' },
    info:    { bg:'#eff6ff', border:'#93c5fd', color:'#1e40af' },
    warning: { bg:'#fffbeb', border:'#fcd34d', color:'#92400e' },
  };
  const c = colors[type] || colors.info;
  toast.style.background = c.bg;
  toast.style.border = `1px solid ${c.border}`;
  toast.style.color = c.color;
  toast.textContent = message;
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
  }, duration);
}

// ---- Simple debounce ----
function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// ---- CSV Export ----
function exportToCSV(data, filename) {
  if (!data || !data.length) { showToast('Nenhum dado para exportar', 'warning'); return; }
  const keys = Object.keys(data[0]);
  const csvRows = [
    keys.join(';'),
    ...data.map(row => keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(';'))
  ];
  const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---- Rate limiting (simple local) ----
const _rateLimitStore = {};
function checkRateLimit(key, limitSeconds = 60) {
  const now = Date.now();
  const last = _rateLimitStore[key] || 0;
  if (now - last < limitSeconds * 1000) return false; // blocked
  _rateLimitStore[key] = now;
  return true; // allowed
}
