import {
  createContext,
  useContext,
  useEffect,
  useRef,
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

  // Keep a stable ref to the current user so the background callback can
  // read the user id without stale-closure issues.
  const userRef = useRef<User | null>(null)
  useEffect(() => { userRef.current = user }, [user])

  const updateAvatar = useCallback(async (emoji: string): Promise<string | null> => {
    // Optimistic update – show the change immediately and close the modal
    // without waiting for the network round-trip.
    setUser(prev =>
      prev ? { ...prev, user_metadata: { ...prev.user_metadata, avatar: emoji } } : prev
    )

    // Persist locally so the avatar survives a page reload even if the
    // Supabase sync below is slow or fails.
    const uid = userRef.current?.id
    if (uid) {
      try { localStorage.setItem(`dtb_avatar_${uid}`, emoji) } catch { /* quota exceeded etc. */ }
    }

    // Background sync to Supabase – we intentionally don't await this.
    void supabase.auth.updateUser({ data: { avatar: emoji } })
      .then(({ data }) => {
        if (data.user) {
          setUser(data.user)
          // Supabase is now the canonical source; remove the local copy so
          // a newer change from another device isn't overridden on next load.
          try { localStorage.removeItem(`dtb_avatar_${data.user.id}`) } catch { /* ignore */ }
        }
      })
      .catch((e) => {
        // Sync failed – local state and localStorage retain the change so the
        // avatar is still visible in this session and on reload.
        console.warn('[DevToolbox] Avatar sync to Supabase failed; local copy retained.', e)
      })

    return null
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
