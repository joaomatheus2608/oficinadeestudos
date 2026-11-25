/**
 * OFICINA DE ESTUDOS — Gerenciamento de Cookies (LGPD)
 * Armazena a escolha do visitante e permite reabrir preferências pelo rodapé.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'oe_cookie_consent_v1';

  function getConsent() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function saveConsent(prefs) {
    const payload = {
      essential: true,
      analytics: Boolean(prefs.analytics),
      timestamp: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {}
    // Also set a first-party functional cookie (180 days)
    document.cookie = `oe_cookie_consent=${payload.analytics ? 'all' : 'essential'}; path=/; max-age=15552000; SameSite=Lax`;
  }

  function createBanner() {
    if (document.getElementById('oe-cookie-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'oe-cookie-banner';
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Aviso de Cookies e Privacidade');

    banner.innerHTML = `
      <div class="cookie-banner__inner">
        <div class="cookie-banner__text">
          <strong>Privacidade & Cookies (LGPD)</strong>
          <p>
            Utilizamos cookies essenciais para o funcionamento seguro da plataforma e proteção contra spam.
            Consulte nossa <a href="privacidade.html">Política de Privacidade</a> e
            <a href="termos.html">Termos de Uso</a>.
          </p>
        </div>
        <div class="cookie-banner__actions">
          <button type="button" class="cookie-btn cookie-btn--ghost" id="oe-cookie-essential">Apenas Essenciais</button>
          <button type="button" class="cookie-btn cookie-btn--primary" id="oe-cookie-accept">Aceitar Todos</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('visible'));

    document.getElementById('oe-cookie-essential').addEventListener('click', () => {
      saveConsent({ analytics: false });
      hideBanner();
    });

    document.getElementById('oe-cookie-accept').addEventListener('click', () => {
      saveConsent({ analytics: true });
      hideBanner();
    });
  }

  function hideBanner() {
    const banner = document.getElementById('oe-cookie-banner');
    if (!banner) return;
    banner.classList.remove('visible');
    setTimeout(() => banner.remove(), 300);
  }

  function init() {
    if (!getConsent()) {
      createBanner();
    }

    const manageBtn = document.getElementById('manage-cookies-btn');
    if (manageBtn) {
      manageBtn.addEventListener('click', (e) => {
        e.preventDefault();
        createBanner();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
