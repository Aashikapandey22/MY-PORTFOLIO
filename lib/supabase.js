import { createClient } from '@supabase/supabase-js';

export function getSupabaseConfig(env = process.env) {
  return {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
  };
}

export function isSupabaseConfigured(env = process.env) {
  const config = getSupabaseConfig(env);
  return Boolean(config.url && config.anonKey && config.serviceRoleKey);
}

export function createSupabaseClients(env = process.env) {
  const config = getSupabaseConfig(env);
  if (!isSupabaseConfigured(env)) return null;
  return {
    admin: createClient(config.url, config.serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } }),
    auth: createClient(config.url, config.anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  };
}
