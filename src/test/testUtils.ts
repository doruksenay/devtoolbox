import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { AllProviders } from './providers'

/**
 * Renders `ui` inside the app's real provider stack (auth → app state → toasts).
 *
 * No Supabase stub is needed: `vitest.config.ts` deliberately leaves the
 * credentials unset, so `isSupabaseConfigured` is false and the providers take
 * their local-only path without ever loading the client.
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): RenderResult {
  return render(ui, { wrapper: AllProviders, ...options })
}

/** Key `AppProvider` persists preferences under, mirrored from AppContext. */
export const STORAGE_KEY = 'devtoolbox_state_v1'

/** Clears everything a previous test could have leaked into storage or the DOM. */
export function resetAppEnvironment(): void {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
}
