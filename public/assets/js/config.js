/**
 * OFICINA DE ESTUDOS — Client-side Supabase & Funnel Config
 * Only PUBLIC keys go here (anon key is safe for browser).
 * NEVER expose the service_role key on the frontend.
 */
const APP_CONFIG = {
  supabaseUrl:    window.__ENV?.SUPABASE_URL     || 'YOUR_SUPABASE_URL',
  supabaseAnonKey: window.__ENV?.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY',
  // Edge function base URL (same Supabase project)
  edgeFunctionsUrl: (window.__ENV?.SUPABASE_URL || 'YOUR_SUPABASE_URL') + '/functions/v1',
  // Número oficial de destino do Funil WhatsApp (DDI 55 + DDD + número, apenas dígitos)
  // Altere apenas esta linha quando a cliente definir o WhatsApp oficial de atendimento.
  whatsappDestinationNumber: window.__ENV?.WHATSAPP_NUMBER || '5581999999999',
};

// Make Supabase client available globally
// Supabase JS CDN is loaded in the HTML
function getSupabaseClient() {
  if (!window._supabaseClient) {
    window._supabaseClient = window.supabase.createClient(
      APP_CONFIG.supabaseUrl,
      APP_CONFIG.supabaseAnonKey
    );
  }
  return window._supabaseClient;
}
