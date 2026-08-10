import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Accounts and cross-device sync are optional. When the environment variables
 * are missing the app must still work as a fully local toolbox, so we fall back
 * to placeholder credentials and expose this flag so callers can skip network
 * round-trips instead of crashing at startup.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.warn(
    '[DevToolbox] Supabase env vars are not set. ' +
      'Account features are disabled. Copy .env.example to .env.local to enable them.',
  )
}

let clientPromise: Promise<SupabaseClient> | null = null

/**
 * Resolves the Supabase client, loading the library on first use. Signing in is
 * optional and most visitors never do, so the client is kept out of the initial
 * bundle rather than created at module load.
 */
export function getSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(
        supabaseUrl || 'http://localhost:54321',
        supabaseAnonKey || 'public-anon-key-placeholder',
        isSupabaseConfigured ? undefined : { auth: { persistSession: false, autoRefreshToken: false } },
      ),
    )
  }
  return clientPromise
}
