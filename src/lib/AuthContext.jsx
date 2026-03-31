import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null)
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) loadProfile(session.user.id)
        else setProfile(null)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    try {
      const { data, error, status } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (status === 404 || status === 400) {
        // Table not ready or RLS issue -- treat as no profile
        setProfile(null)
        return
      }
      if (!error) setProfile(data ?? null)
    } catch (err) {
      console.warn('Could not load profile (non-fatal):', err.message)
      setProfile(null)
    }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signUp = async ({ email, password, displayName, role = 'director', clubName = '' }) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) return { data: null, error }
      if (!data.user) return { data: null, error: new Error('No user returned') }

      // Create profile row -- non-blocking, don't fail signup if this errors
      try {
        await supabase.from('user_profiles').insert({
          id:           data.user.id,
          email,
          display_name: displayName,
          role,
          club_name:    clubName || null,
        })
      } catch (profileErr) {
        console.warn('Profile creation failed (non-fatal):', profileErr)
      }

      return { data, error: null }
    } catch (err) {
      return { data: null, error: err }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const updateProfile = async (updates) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', user?.id)
      .select()
      .single()
    if (data) setProfile(data)
    return { data, error }
  }

  // If logged in but no profile row yet, default to director access
  // (they created an account so they're a director until proven otherwise)
  const isDirector = profile?.role === 'director' || profile?.role === 'admin' || (user && !profile)
  const isAdmin    = profile?.role === 'admin'

  return (
    <AuthContext.Provider value={{
      user, session, profile,
      signIn, signUp, signOut, updateProfile,
      isDirector, isAdmin,
      loading: user === undefined,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
