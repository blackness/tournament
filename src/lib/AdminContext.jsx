import { createContext, useContext, useState, useEffect } from 'react'

const AdminContext = createContext(null)

const SIMULATE_KEY = 'athleteos_simulate'

export function AdminProvider({ children }) {
  const [simulatedUser, setSimulatedUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(SIMULATE_KEY)) } catch { return null }
  })

  function startSimulation(user) {
    sessionStorage.setItem(SIMULATE_KEY, JSON.stringify(user))
    setSimulatedUser(user)
  }

  function stopSimulation() {
    sessionStorage.removeItem(SIMULATE_KEY)
    setSimulatedUser(null)
  }

  return (
    <AdminContext.Provider value={{ simulatedUser, startSimulation, stopSimulation, isSimulating: !!simulatedUser }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be inside AdminProvider')
  return ctx
}
