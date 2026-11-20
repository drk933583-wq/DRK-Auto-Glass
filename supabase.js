import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG, isConfigured } from './config.js';
export const supabase = isConfigured() ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY) : null;

/** Loads public website_settings into a plain {key: value} object. Throws on failure (never silent). */
export async function loadSettings() {
  if (!supabase) throw new Error('Supabase is not configured. Edit public/js/config.js');
  const { data, error } = await supabase.from('website_settings').select('key,value');
  if (error) throw error;
  return Object.fromEntries(data.map(r => [r.key, r.value]));
}

export const publicUrl = (bucket, path) => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
