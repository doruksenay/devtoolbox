import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────
interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<{ error: string | null; autoSignedIn: boolean }>
  signOut: () => Promise<void>
  changePassword: (newPassword: string) => Promise<string | null>
  updateAvatar: (emoji: string) => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ─────────────────────────────────────────────
//  Provider
// ─────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = user?.app_metadata?.role === 'admin'

  useEffect(() => {
    // Get existing session on mount
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess)
      setUser(sess?.user ?? null)
      setLoading(false)

      // Log a login event whenever the user signs in
      if (event === 'SIGNED_IN' && sess?.user?.id) {
        void supabase
          .from('login_events')
          .insert({ user_id: sess.user.id })
          .then(({ error }) => {
            if (error) console.error('[DevToolbox] Failed to log login event:', error.message)
          })
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }, [])

  const signUp = useCallback(async (email: string, password: string): Promise<{ error: string | null; autoSignedIn: boolean }> => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null, autoSignedIn: !!data.session }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const changePassword = useCallback(async (newPassword: string): Promise<string | null> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return error?.message ?? null
  }, [])

  const updateAvatar = useCallback(async (emoji: string): Promise<string | null> => {
    try {
      const timeoutMs = 10_000
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please try again.')), timeoutMs)
      )
      const { data, error } = await Promise.race([
        supabase.auth.updateUser({ data: { avatar: emoji } }),
        timeout,
      ])
      if (error) return error.message
      if (data.user) setUser(data.user)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Failed to update avatar'
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signIn, signUp, signOut, changePassword, updateAvatar }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─────────────────────────────────────────────
//  Hook
// ─────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
