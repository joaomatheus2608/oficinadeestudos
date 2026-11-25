/**
 * OFICINA DE ESTUDOS — Landing Page Logic
 * Carrega campanha ativa do Supabase e gerencia o formulário de lead.
 */

(function () {
  'use strict';

  // ---- State ----
  let activeCampaign = null;
  let isSubmitting   = false;

  // ---- DOM refs ----
  const heroTitle       = document.getElementById('hero-title');
  const heroTitleHL     = document.getElementById('hero-title-highlight');
  const heroDesc        = document.getElementById('hero-desc');
  const heroLabel       = document.getElementById('hero-label');
  const heroCTABtn      = document.getElementById('hero-cta-btn');
  const heroImage       = document.getElementById('hero-image');
  const heroPlaceholder = document.getElementById('hero-placeholder');
  const formMaterialName= document.getElementById('form-material-name');
  const noCampaign      = document.getElementById('no-campaign');
  const heroSection     = document.getElementById('inicio');
  const benefitsSection = document.getElementById('beneficios');
  const formSection     = document.getElementById('solicitar');

  const form         = document.getElementById('lead-form');
  const submitBtn    = document.getElementById('submit-btn');
  const submitSpinner= document.getElementById('submit-spinner');
  const successScreen= document.getElementById('success-screen');
  const formBody     = document.getElementById('form-body');
  const successEmail = document.getElementById('success-email');
  const alertError   = document.getElementById('form-alert-error');
  const alertErrorMsg= document.getElementById('form-alert-error-msg');

  const pageTitle    = document.getElementById('page-title');
  const pageDesc     = document.getElementById('page-desc');
  const ogTitle      = document.getElementById('og-title');
  const ogDesc       = document.getElementById('og-desc');

  // Fields
  const fName    = document.getElementById('lead-name');
  const fEmail   = document.getElementById('lead-email');
  const fPhone   = document.getElementById('lead-phone');
  const fPrivacy = document.getElementById('lead-privacy');

  // Error messages
  const errName    = document.getElementById('err-name');
  const errEmail   = document.getElementById('err-email');
  const errPhone   = document.getElementById('err-phone');
  const errPrivacy = document.getElementById('err-privacy');

  // ---- Init ----
  async function init() {
    await loadActiveCampaign();
    setupForm();
  }

  // ---- Load active campaign from Supabase ----
  async function loadActiveCampaign() {
    try {
      const sb = getSupabaseClient();
      const { data, error } = await sb
        .from('campaigns')
        .select('id, name, title, description, image_url, material_url, email_subject, email_content')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // No active campaign
        showNoCampaign();
        return;
      }

      activeCampaign = data;
      applyCampaignToPage(data);
    } catch (err) {
      console.error('[OE] Error loading campaign:', err);
      // Show page normally with defaults
    }
  }

  function showNoCampaign() {
    if (noCampaign)      noCampaign.style.display = '';
    if (heroSection)     heroSection.style.display = 'none';
    if (benefitsSection) benefitsSection.style.display = 'none';
    if (formSection)     formSection.style.display = 'none';
  }

  function applyCampaignToPage(campaign) {
    // Page meta
    if (pageTitle)  pageTitle.textContent  = `${campaign.title} — Oficina de Estudos`;
    if (pageDesc)   pageDesc.setAttribute('content', campaign.description || '');
    if (ogTitle)    ogTitle.setAttribute('content', `${campaign.title} — Oficina de Estudos`);
    if (ogDesc)     ogDesc.setAttribute('content', campaign.description || '');

    // Hero
    if (heroTitleHL) heroTitleHL.textContent = campaign.title;
    if (heroDesc)    heroDesc.textContent     = campaign.description || heroDesc.textContent;
    if (heroLabel) {
      heroLabel.querySelector('span').textContent = campaign.name || 'Material Exclusivo e Gratuito';
    }

    // Campaign image
    if (campaign.image_url) {
      if (heroImage) {
        heroImage.src = campaign.image_url;
        heroImage.alt = campaign.title;
        heroImage.style.display = '';
      }
      if (heroPlaceholder) heroPlaceholder.style.display = 'none';
    }

    // Form title
    if (formMaterialName) formMaterialName.textContent = campaign.title || 'Material Gratuito';
  }

  // ---- Phone mask ----
  if (fPhone) {
    fPhone.addEventListener('input', () => {
      fPhone.value = formatPhoneBR(fPhone.value);
    });
  }

  // ---- Live validation helpers ----
  function setFieldState(field, errEl, valid) {
    if (valid) {
      field.classList.remove('error');
      errEl.classList.remove('visible');
    } else {
      field.classList.add('error');
      errEl.classList.add('visible');
    }
    return valid;
  }

  function validateAll() {
    let ok = true;
    if (!setFieldState(fName,    errName,    Validate.name(fName.value)))    ok = false;
    if (!setFieldState(fEmail,   errEmail,   Validate.email(fEmail.value)))  ok = false;
    if (!setFieldState(fPhone,   errPhone,   Validate.phone(fPhone.value)))  ok = false;
    if (!setFieldState(fPrivacy, errPrivacy, fPrivacy.checked))              ok = false;
    return ok;
  }

  function setupForm() {
    if (!form) return;

    // Step-by-step wizard state
    let currentStep = 1;
    const totalSteps = 3;
    const stepEls = document.querySelectorAll('.form-step');
    const timelineSteps = document.querySelectorAll('.timeline__step');
    const timelineFill = document.getElementById('timeline-fill');
    const stepCounter = document.getElementById('step-counter');
    const timelineBar = document.getElementById('form-timeline');

    function goToStep(step) {
      currentStep = step;
      stepEls.forEach(el => {
        el.classList.toggle('active', Number(el.dataset.step) === step);
      });
      timelineSteps.forEach(el => {
        const s = Number(el.dataset.step);
        el.classList.toggle('active', s === step);
        el.classList.toggle('done', s < step);
        const dot = el.querySelector('.timeline__dot');
        if (dot) dot.textContent = s < step ? '✓' : String(s);
      });
      if (timelineFill) {
        const pct = ((step - 1) / (totalSteps - 1)) * 100;
        timelineFill.style.width = `${pct}%`;
      }
      if (stepCounter) stepCounter.textContent = `Passo ${step} de ${totalSteps}`;
      if (timelineBar) timelineBar.setAttribute('aria-valuenow', String(step));

      const focusTarget = step === 1 ? fName : step === 2 ? fEmail : fPhone;
      if (focusTarget) setTimeout(() => focusTarget.focus(), 80);
    }

    const next1 = document.getElementById('next-step-1');
    const next2 = document.getElementById('next-step-2');
    const prev2 = document.getElementById('prev-step-2');
    const prev3 = document.getElementById('prev-step-3');

    if (next1) {
      next1.addEventListener('click', () => {
        if (setFieldState(fName, errName, Validate.name(fName.value))) goToStep(2);
      });
    }
    if (next2) {
      next2.addEventListener('click', () => {
        if (setFieldState(fEmail, errEmail, Validate.email(fEmail.value))) goToStep(3);
      });
    }
    if (prev2) prev2.addEventListener('click', () => goToStep(1));
    if (prev3) prev3.addEventListener('click', () => goToStep(2));

    // Allow Enter key to advance steps
    if (fName) {
      fName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); next1?.click(); }
      });
    }
    if (fEmail) {
      fEmail.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); next2?.click(); }
      });
    }

    // Real-time validation on blur
    if (fName)  fName.addEventListener('blur',  () => setFieldState(fName,  errName,  Validate.name(fName.value)));
    if (fEmail) fEmail.addEventListener('blur', () => setFieldState(fEmail, errEmail, Validate.email(fEmail.value)));
    if (fPhone) fPhone.addEventListener('blur', () => setFieldState(fPhone, errPhone, Validate.phone(fPhone.value)));
    if (fPrivacy) fPrivacy.addEventListener('change', () => setFieldState(fPrivacy, errPrivacy, fPrivacy.checked));

    form.addEventListener('submit', handleSubmit);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate
    if (!validateAll()) {
      showFormError('Por favor, corrija os campos destacados.');
      return;
    }

    // Rate limit: prevent double-clicks / spam
    if (!checkRateLimit('lead-submit', 30)) {
      showFormError('Aguarde alguns segundos antes de tentar novamente.');
      return;
    }

    if (!activeCampaign) {
      showFormError('Nenhuma campanha ativa no momento. Tente novamente mais tarde.');
      return;
    }

    isSubmitting = true;
    setLoadingState(true);
    hideFormError();

    const payload = {
      name:            fName.value.trim(),
      email:           fEmail.value.trim().toLowerCase(),
      phone:           fPhone.value.trim(),
      campaign_id:     activeCampaign.id,
      privacy_consent: true,
    };

    try {
      // 1. Insert lead into Supabase (via edge function to avoid RLS bypass on client)
      const response = await fetch(`${APP_CONFIG.edgeFunctionsUrl}/send-material`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${APP_CONFIG.supabaseAnonKey}`,
          'apikey': APP_CONFIG.supabaseAnonKey,
        },
        body: JSON.stringify(payload),
      });

      let result = null;
      try {
        result = await response.json();
      } catch (_) {}

      if (!response.ok) {
        const msg = result?.error || result?.message || `Erro no servidor (${response.status}).`;
        showFormError(msg);
        return;
      }

      // Show success
      showSuccess(payload.email);
    } catch (err) {
      console.error('[OE] Submit error:', err);
      showFormError(err.message ? `Erro: ${err.message}` : 'Erro de conexão com o servidor. Verifique o console do navegador.');
    } finally {
      isSubmitting = false;
      setLoadingState(false);
    }
  }

  function setLoadingState(loading) {
    if (!submitBtn) return;
    const btnText = submitBtn.querySelector('.btn-text');
    if (loading) {
      submitBtn.disabled = true;
      if (submitSpinner) submitSpinner.style.display = '';
      if (btnText) btnText.style.opacity = '0';
    } else {
      submitBtn.disabled = false;
      if (submitSpinner) submitSpinner.style.display = 'none';
      if (btnText) btnText.style.opacity = '';
    }
  }

  function showFormError(msg) {
    if (alertErrorMsg) alertErrorMsg.textContent = msg;
    if (alertError)    alertError.classList.add('visible');
    submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function hideFormError() {
    if (alertError) alertError.classList.remove('visible');
  }

  function showSuccess(email) {
    if (form) form.style.display = 'none';
    if (successEmail) successEmail.textContent = email;
    if (successScreen) {
      successScreen.classList.add('visible');
      successScreen.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // Track in analytics if needed
    try {
      if (typeof gtag !== 'undefined') {
        gtag('event', 'lead_submitted', { campaign_id: activeCampaign?.id });
      }
    } catch (_) {}
  }

  // ---- Start ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
