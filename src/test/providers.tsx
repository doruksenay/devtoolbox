import type { ReactNode } from 'react'
import { AppProvider } from '../context/AppContext'
import { AuthProvider } from '../context/AuthContext'
import { ToastProvider } from '../components/Toast/ToastProvider'

/**
 * The app's provider stack, nested exactly as `src/main.tsx` nests it.
 *
 * Components read from all three contexts (`useAppSelector`, `useAuth`,
 * `useToast`), so tests mount the real providers rather than stubs — that is
 * what makes a broken selector or a missing provider surface as a test failure
 * instead of a runtime crash in the browser.
 */
export function AllProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppProvider>
        <ToastProvider>{children}</ToastProvider>
      </AppProvider>
    </AuthProvider>
  )
}
