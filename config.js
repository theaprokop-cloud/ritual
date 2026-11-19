// Veřejná konfigurace pro prohlížeč.
// Hodnoty najdeš v Supabase: Project Settings → API.
// Anon klíč je veřejný z principu – data chrání Row Level Security v databázi.
// NIKDY sem nedávej service_role klíč ani klíč k Claude API.
window.RITUAL_CONFIG = {
  SUPABASE_URL: 'https://XXXX.supabase.co',
  SUPABASE_ANON_KEY: 'XXXX',
};
