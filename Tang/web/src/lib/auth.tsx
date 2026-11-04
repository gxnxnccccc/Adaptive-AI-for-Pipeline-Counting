// MOCK login for the demo: any non-empty Operator ID + password gets in. NOT real security.
// Real login (Supabase Auth / company SSO) is Backlog (docs/plans/app-flow.md).
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

const KEY = 'spds.operator'
type StoreName = 'localStorage' | 'sessionStorage'

// Storage can throw (private mode, blocked site data), so every access is wrapped.
function read(store: StoreName): string | null {
  try {
    return window[store].getItem(KEY)
  } catch {
    return null
  }
}
function write(store: StoreName, value: string | null) {
  try {
    if (value === null) window[store].removeItem(KEY)
    else window[store].setItem(KEY, value)
  } catch {
    /* ignore: login still works for this page load */
  }
}

type Auth = {
  operator: string | null
  // Returns false (and does nothing) when a field is empty.
  login: (operatorId: string, password: string, keep?: boolean) => boolean
  logout: () => void
}

const AuthContext = createContext<Auth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [operator, setOperator] = useState<string | null>(() => read('localStorage') ?? read('sessionStorage'))

  const login = useCallback((operatorId: string, password: string, keep = true) => {
    const id = operatorId.trim()
    if (!id || !password.trim()) return false
    // "Keep me signed in" = localStorage, otherwise this tab only.
    write('localStorage', keep ? id : null)
    write('sessionStorage', keep ? null : id)
    setOperator(id)
    return true
  }, [])

  const logout = useCallback(() => {
    write('localStorage', null)
    write('sessionStorage', null)
    setOperator(null)
  }, [])

  const value = useMemo(() => ({ operator, login, logout }), [operator, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): Auth {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
