
export const CONFIG = {
  SUPABASE_URL: 'https://fuixrhalczukhpeizqon.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_IPzWq9X1W32LnIwQ8rUFVw_9nbDXy_O',
};

export const isConfigured = () =>
  CONFIG.SUPABASE_URL.startsWith('https://') &&
  CONFIG.SUPABASE_ANON_KEY.startsWith('sb_publishable_');
