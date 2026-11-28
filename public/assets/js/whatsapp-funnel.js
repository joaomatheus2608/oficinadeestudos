/**
 * OFICINA DE ESTUDOS — Funil de Captação WhatsApp
 * Questionário condicional em 5 etapas:
 * 1. Dados pessoais (Nome, WhatsApp, E-mail + LGPD)
 * 2. Caminho: ENEM ou SSA
 * 3. Ano escolar em 2027 (condicional)
 * 4. Modalidade: Online ou Presencial
 * 5. Rede de ensino (ordem condicional)
 * -> Salva no Supabase (save-whatsapp-lead) -> Redireciona para wa.me
 */
(function () {
  'use strict';

  const YEAR_OPTIONS = {
    enem: [
      { value: 'concluiu', label: 'Concluí o Ensino Médio' },
      { value: '1_ano', label: '1º ano' },
      { value: '2_ano', label: '2º ano' },
      { value: '3_ano', label: '3º ano' },
    ],
    ssa: [
      { value: '9_ano', label: '9º ano' },
      { value: '1_ano', label: '1º ano' },
      { value: '2_ano', label: '2º ano' },
      { value: '3_ano', label: '3º ano' },
    ],
  };

  const NETWORK_OPTIONS = {
    enem: [
      { value: 'publica', label: 'Estudante de rede pública' },
      { value: 'particular', label: 'Estudante de rede particular' },
    ],
    ssa: [
      { value: 'particular', label: 'Estudante de rede particular' },
      { value: 'publica', label: 'Estudante de rede pública' },
    ],
  };

  const YEAR_LABELS = {
    concluiu: 'Concluí o Ensino Médio',
    '9_ano': '9º ano',
    '1_ano': '1º ano',
    '2_ano': '2º ano',
    '3_ano': '3º ano',
  };

  const MODALITY_LABELS = {
    online: 'ONLINE',
    presencial: 'PRESENCIAL',
  };

  const NETWORK_LABELS = {
    publica: 'PÚBLICA',
    particular: 'PARTICULAR',
  };

  const state = {
    step: 1,
    interest: '',
    school_year_2027: '',
    modality: '',
    school_network: '',
    isSubmitting: false,
  };

  const form = document.getElementById('wa-funnel-form');
  const fName = document.getElementById('wa-name');
  const fPhone = document.getElementById('wa-phone');
  const fEmail = document.getElementById('wa-email');
  const fPrivacy = document.getElementById('wa-privacy');

  const errName = document.getElementById('err-wa-name');
  const errPhone = document.getElementById('err-wa-phone');
  const errEmail = document.getElementById('err-wa-email');
  const errPrivacy = document.getElementById('err-wa-privacy');
  const errInterest = document.getElementById('err-wa-interest');
  const errYear = document.getElementById('err-wa-year');
  const errModality = document.getElementById('err-wa-modality');
  const errNetwork = document.getElementById('err-wa-network');

  const alertError = document.getElementById('wa-alert-error');
  const alertErrorMsg = document.getElementById('wa-alert-error-msg');
  const submitBtn = document.getElementById('wa-submit-btn');
  const submitSpinner = document.getElementById('wa-submit-spinner');
  const successScreen = document.getElementById('wa-success-screen');
  const fallbackLink = document.getElementById('wa-fallback-link');

  function setFieldState(field, errEl, valid) {
    if (field) field.classList.toggle('error', !valid);
    if (errEl) errEl.classList.toggle('visible', !valid);
    return valid;
  }

  function goToStep(step) {
    state.step = step;
    const total = 5;
    document.querySelectorAll('.form-step').forEach((el) => {
      el.classList.toggle('active', Number(el.dataset.step) === step);
    });
    document.querySelectorAll('#wa-timeline .timeline__step').forEach((el) => {
      const s = Number(el.dataset.step);
      el.classList.toggle('active', s === step);
      el.classList.toggle('done', s < step);
      const dot = el.querySelector('.timeline__dot');
      if (dot) dot.textContent = s < step ? '✓' : String(s);
    });
    const fill = document.getElementById('wa-timeline-fill');
    if (fill) fill.style.width = `${((step - 1) / (total - 1)) * 100}%`;
    const counter = document.getElementById('wa-step-counter');
    if (counter) counter.textContent = `Passo ${step} de ${total}`;
    const bar = document.getElementById('wa-timeline');
    if (bar) bar.setAttribute('aria-valuenow', String(step));
  }

  function renderChoiceButtons(containerId, options, selectedValue, onSelect) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = options
      .map(
        (opt) => `
      <button type="button" class="choice-card ${selectedValue === opt.value ? 'selected' : ''}" data-value="${opt.value}">
        <span class="choice-card__title">${opt.label}</span>
      </button>`
      )
      .join('');

    container.querySelectorAll('.choice-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.choice-card').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        onSelect(btn.dataset.value);
      });
    });
  }

  function setupStaticChoices(containerId, onSelect) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.choice-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.choice-card').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        onSelect(btn.dataset.value);
      });
    });
  }

  function validateStep1() {
    let ok = true;
    if (!setFieldState(fName, errName, Validate.name(fName.value))) ok = false;
    if (!setFieldState(fPhone, errPhone, Validate.phone(fPhone.value))) ok = false;
    if (!setFieldState(fEmail, errEmail, Validate.email(fEmail.value))) ok = false;
    if (!setFieldState(fPrivacy, errPrivacy, fPrivacy.checked)) ok = false;
    return ok;
  }

  function buildRedirectUrl(payload) {
    const dest = String(APP_CONFIG.whatsappDestinationNumber || '').replace(/\D/g, '');
    const msg = [
      `Olá! Meu nome é ${payload.name}.`,
      '',
      `Tenho interesse no ${payload.interest.toUpperCase()}.`,
      `Ano escolar: ${YEAR_LABELS[payload.school_year_2027] || payload.school_year_2027}.`,
      `Modalidade: ${MODALITY_LABELS[payload.modality] || payload.modality}.`,
      `Rede de ensino: ${NETWORK_LABELS[payload.school_network] || payload.school_network}.`,
      '',
      'Gostaria de saber mais sobre o curso!',
    ].join('\n');

    return `https://wa.me/${dest}?text=${encodeURIComponent(msg)}`;
  }

  function setLoading(loading) {
    state.isSubmitting = loading;
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    const txt = submitBtn.querySelector('.btn-text');
    if (txt) txt.style.opacity = loading ? '0' : '';
    if (submitSpinner) submitSpinner.style.display = loading ? '' : 'none';
  }

  function showError(msg) {
    if (alertErrorMsg) alertErrorMsg.textContent = msg;
    if (alertError) alertError.classList.add('visible');
  }

  function hideError() {
    if (alertError) alertError.classList.remove('visible');
  }

  function init() {
    if (fPhone) {
      fPhone.addEventListener('input', () => {
        fPhone.value = formatPhoneBR(fPhone.value);
      });
    }

    if (fName) fName.addEventListener('blur', () => setFieldState(fName, errName, Validate.name(fName.value)));
    if (fPhone) fPhone.addEventListener('blur', () => setFieldState(fPhone, errPhone, Validate.phone(fPhone.value)));
    if (fEmail) fEmail.addEventListener('blur', () => setFieldState(fEmail, errEmail, Validate.email(fEmail.value)));
    if (fPrivacy) fPrivacy.addEventListener('change', () => setFieldState(fPrivacy, errPrivacy, fPrivacy.checked));

    // Step 2 choice: ENEM / SSA
    setupStaticChoices('choice-interest', (val) => {
      if (state.interest !== val) {
        state.interest = val;
        state.school_year_2027 = '';
        state.school_network = '';
      }
      errInterest?.classList.remove('visible');
    });

    // Step 4 choice: Online / Presencial
    setupStaticChoices('choice-modality', (val) => {
      state.modality = val;
      errModality?.classList.remove('visible');
    });

    // Navigation buttons
    document.getElementById('wa-next-1')?.addEventListener('click', () => {
      if (validateStep1()) goToStep(2);
    });

    document.getElementById('wa-prev-2')?.addEventListener('click', () => goToStep(1));
    document.getElementById('wa-next-2')?.addEventListener('click', () => {
      if (!state.interest) {
        errInterest?.classList.add('visible');
        return;
      }
      renderChoiceButtons('choice-year', YEAR_OPTIONS[state.interest], state.school_year_2027, (val) => {
        state.school_year_2027 = val;
        errYear?.classList.remove('visible');
      });
      renderChoiceButtons('choice-network', NETWORK_OPTIONS[state.interest], state.school_network, (val) => {
        state.school_network = val;
        errNetwork?.classList.remove('visible');
      });
      goToStep(3);
    });

    document.getElementById('wa-prev-3')?.addEventListener('click', () => goToStep(2));
    document.getElementById('wa-next-3')?.addEventListener('click', () => {
      if (!state.school_year_2027) {
        errYear?.classList.add('visible');
        return;
      }
      goToStep(4);
    });

    document.getElementById('wa-prev-4')?.addEventListener('click', () => goToStep(3));
    document.getElementById('wa-next-4')?.addEventListener('click', () => {
      if (!state.modality) {
        errModality?.classList.add('visible');
        return;
      }
      goToStep(5);
    });

    document.getElementById('wa-prev-5')?.addEventListener('click', () => goToStep(4));

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (state.isSubmitting) return;
      hideError();

      if (!validateStep1()) { goToStep(1); return; }
      if (!state.interest) { goToStep(2); errInterest?.classList.add('visible'); return; }
      if (!state.school_year_2027) { goToStep(3); errYear?.classList.add('visible'); return; }
      if (!state.modality) { goToStep(4); errModality?.classList.add('visible'); return; }
      if (!state.school_network) {
        errNetwork?.classList.add('visible');
        return;
      }

      if (!checkRateLimit('wa-funnel-submit', 15)) {
        showError('Aguarde alguns segundos antes de enviar novamente.');
        return;
      }

      setLoading(true);

      const payload = {
        name: fName.value.trim(),
        phone: fPhone.value.trim(),
        email: fEmail.value.trim().toLowerCase(),
        interest: state.interest,
        school_year_2027: state.school_year_2027,
        modality: state.modality,
        school_network: state.school_network,
        entry_page: window.location.pathname || '/funil-captacao-whatsapp',
        privacy_consent: true,
      };

      try {
        const resp = await fetch(`${APP_CONFIG.edgeFunctionsUrl}/save-whatsapp-lead`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${APP_CONFIG.supabaseAnonKey}`,
            apikey: APP_CONFIG.supabaseAnonKey,
          },
          body: JSON.stringify(payload),
        });

        let result = null;
        try { result = await resp.json(); } catch (_) {}

        if (!resp.ok) {
          showError(result?.error || `Erro ao salvar cadastro (${resp.status}).`);
          return;
        }

        const waUrl = buildRedirectUrl(payload);
        if (form) form.style.display = 'none';
        if (fallbackLink) fallbackLink.href = waUrl;
        if (successScreen) successScreen.classList.add('visible');

        // Redirect after DB confirmation
        setTimeout(() => {
          window.location.href = waUrl;
        }, 700);
      } catch (err) {
        console.error('[OE] WhatsApp funnel submit error:', err);
        showError('Erro de conexão ao salvar seus dados. Tente novamente.');
      } finally {
        setLoading(false);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
