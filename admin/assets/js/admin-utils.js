/**
 * OFICINA DE ESTUDOS — Admin Shared Utilities
 */
(function(global) {
  'use strict';

  const SUPABASE_URL     = window.__ENV?.SUPABASE_URL     || 'YOUR_SUPABASE_URL';
  const SUPABASE_ANON_KEY= window.__ENV?.SUPABASE_ANON_KEY|| 'YOUR_SUPABASE_ANON_KEY';

  // ---- Supabase singleton (with safe offline/preview fallback) ----
  let _sb = null;
  function createQueryStub() {
    const emptyRes = Promise.resolve({ data: [], count: 0, error: null });
    const stub = {
      select: () => stub,
      insert: () => Promise.resolve({ data: null, error: { message: 'Configure o Supabase para salvar dados.' } }),
      update: () => stub,
      delete: () => stub,
      eq:     () => stub,
      neq:    () => stub,
      gte:    () => stub,
      lt:     () => stub,
      order:  () => stub,
      limit:  () => stub,
      then:   (res, rej) => emptyRes.then(res, rej),
    };
    return stub;
  }

  function getSB() {
    if (!_sb) {
      const isConfigured = SUPABASE_URL && !SUPABASE_URL.includes('YOUR_SUPABASE_URL');
      if (isConfigured) {
        _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      } else {
        _sb = {
          from: () => createQueryStub(),
          storage: {
            from: () => ({
              upload: async () => ({ data: null, error: { message: 'Configure o Supabase para fazer upload.' } }),
              getPublicUrl: () => ({ data: { publicUrl: '' } }),
            }),
          },
          auth: {
            getSession: async () => ({ data: { session: null } }),
            signOut:    async () => ({}),
            updateUser: async () => ({ error: { message: 'Configure o Supabase para alterar a senha.' } }),
          },
        };
      }
    }
    return _sb;
  }
  global.getSB = getSB;

  // ---- Auth guard: redirect to login if not authenticated ----
  async function requireAuth() {
    const sb = getSB();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return null;
    }
    return session;
  }
  global.requireAuth = requireAuth;

  // ---- Sign out ----
  async function signOut() {
    localStorage.removeItem('oe_demo_admin');
    await getSB().auth.signOut();
    window.location.href = 'login.html';
  }
  global.signOut = signOut;

  // ---- Date formatting ----
  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR', {
      day:'2-digit', month:'2-digit', year:'numeric',
      hour:'2-digit', minute:'2-digit'
    });
  }
  function fmtDateOnly(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
  }
  global.fmtDate = fmtDate;
  global.fmtDateOnly = fmtDateOnly;

  // ---- WhatsApp link ----
  function whatsAppLink(phone, msg='') {
    const d = (phone||'').replace(/\D/g,'');
    const intl = d.startsWith('55') ? d : '55'+d;
    return `https://wa.me/${intl}${msg ? '?text='+encodeURIComponent(msg) : ''}`;
  }
  global.whatsAppLink = whatsAppLink;

  // ---- Toast ----
  let _toastT;
  function toast(msg, type='info', dur=4000) {
    let el = document.getElementById('admin-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'admin-toast';
      document.body.appendChild(el);
    }
    const styles = {
      success: { bg:'#f0fdf4', border:'#86efac', color:'#166534' },
      error:   { bg:'#fef2f2', border:'#fca5a5', color:'#991b1b' },
      info:    { bg:'#eff6ff', border:'#93c5fd', color:'#1e40af' },
      warning: { bg:'#fffbeb', border:'#fcd34d', color:'#92400e' },
    };
    const s = styles[type] || styles.info;
    el.style.background = s.bg;
    el.style.border = `1px solid ${s.border}`;
    el.style.color  = s.color;
    el.textContent  = msg;
    el.classList.add('show');
    clearTimeout(_toastT);
    _toastT = setTimeout(() => el.classList.remove('show'), dur);
  }
  global.toast = toast;

  // ---- Status badge ----
  const STATUS_LABELS = {
    pending:    'Pendente',
    processing: 'Processando',
    sent:       'Enviado',
    delivered:  'Entregue',
    failed:     'Falhou',
    rejected:   'Rejeitado',
    active:     'Ativa',
    inactive:   'Inativa',
  };
  function statusBadge(status) {
    const label = STATUS_LABELS[status] || status;
    return `<span class="status-badge status-badge--${status}">${label}</span>`;
  }
  global.statusBadge = statusBadge;

  // ---- CSV Export ----
  function exportCSV(data, filename) {
    if (!data?.length) { toast('Nenhum dado para exportar', 'warning'); return; }
    const keys = Object.keys(data[0]);
    const rows = [
      keys.join(';'),
      ...data.map(r => keys.map(k => `"${String(r[k]??'').replace(/"/g,'""')}"`).join(';'))
    ];
    const blob = new Blob(['\uFEFF'+rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  global.exportCSV = exportCSV;

  // ---- Debounce ----
  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(()=>fn(...args), ms); };
  }
  global.debounce = debounce;

  // ---- Sidebar / nav helper ----
  function initSidebar() {
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('sidebar-overlay');
    const menuBtn  = document.getElementById('topbar-menu-btn');

    function open()  { sidebar?.classList.add('open');  overlay?.classList.add('open'); }
    function close() { sidebar?.classList.remove('open'); overlay?.classList.remove('open'); }

    menuBtn?.addEventListener('click', () => sidebar?.classList.contains('open') ? close() : open());
    overlay?.addEventListener('click', close);

    // Sign out button
    document.getElementById('signout-btn')?.addEventListener('click', signOut);

    // Active nav link
    const page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
      if (link.dataset.page === page) link.classList.add('active');
    });
  }
  global.initSidebar = initSidebar;

  // ---- Simple chart (canvas bar) ----
  function drawBarChart(canvasId, labels, values, color = '#FF5500') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pad = { top: 20, right: 20, bottom: 36, left: 44 };
    const max = Math.max(...values, 1);
    const barW = Math.max(8, Math.floor((W - pad.left - pad.right) / labels.length) - 8);

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = '#D8DEE9'; ctx.lineWidth = 1;
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const y = pad.top + ((H - pad.top - pad.bottom) / steps) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      ctx.fillStyle = '#5A6578'; ctx.font = '10px Inter,sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(Math.round(max - (max / steps) * i), pad.left - 6, y + 4);
    }

    // Bars
    values.forEach((val, i) => {
      const x = pad.left + i * ((W - pad.left - pad.right) / labels.length) + 4;
      const h = ((val / max) * (H - pad.top - pad.bottom)) || 2;
      const y = H - pad.bottom - h;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, barW, h, [4,4,0,0]) : ctx.rect(x, y, barW, h);
      ctx.fill();

      // Label
      ctx.fillStyle = '#5A6578'; ctx.font = '9px Inter,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(labels[i], x + barW / 2, H - pad.bottom + 14);

      // Value on top
      if (val > 0) {
        ctx.fillStyle = '#121926'; ctx.font = 'bold 10px Inter,sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(val, x + barW / 2, y - 4);
      }
    });
  }
  global.drawBarChart = drawBarChart;

  // ---- Pagination helper ----
  function buildPagination(containerId, currentPage, totalPages, onPage) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    wrap.innerHTML = '';
    if (totalPages <= 1) return;

    function btn(label, page, disabled, active) {
      const b = document.createElement('button');
      b.className = 'page-btn' + (active ? ' active' : '');
      b.textContent = label;
      b.disabled = disabled;
      b.addEventListener('click', () => onPage(page));
      wrap.appendChild(b);
    }

    btn('‹', currentPage - 1, currentPage === 1, false);
    const range = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) range.push(i);
      else if (range[range.length-1] !== '…') range.push('…');
    }
    range.forEach(p => {
      if (p === '…') {
        const s = document.createElement('button');
        s.className = 'page-btn'; s.textContent = '…'; s.disabled = true;
        wrap.appendChild(s);
      } else {
        btn(p, p, false, p === currentPage);
      }
    });
    btn('›', currentPage + 1, currentPage === totalPages, false);
  }
  global.buildPagination = buildPagination;

})(window);
