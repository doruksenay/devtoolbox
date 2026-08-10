import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['node_modules', 'e2e'],
    // No Supabase credentials on purpose: `isSupabaseConfigured` stays false, so
    // the providers take their local-only path and no test can reach for the
    // client. These used to be set because `lib/supabase.ts` called
    // `createClient` at module load and threw without a valid URL; the client is
    // created lazily now, so the placeholders only served to switch account
    // features *on* during tests.
  },
})
