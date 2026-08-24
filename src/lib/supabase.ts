import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Ensures the current browser has a Supabase auth session, signing in
 * anonymously if it doesn't. Used on the two participant-facing flows
 * (submitting an expectation, taking a test) that don't require a real
 * account — mirrors the old `signInAnonymously(auth)` calls.
 *
 * Requires "Allow anonymous sign-ins" to be enabled in the Supabase
 * dashboard under Authentication > Settings.
 */
export async function ensureAnonymousSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error('Anonymous sign-in failed:', error);
    return null;
  }
  return data.user;
}
