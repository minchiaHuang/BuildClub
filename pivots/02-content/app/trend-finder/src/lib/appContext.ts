import { createContext, useContext } from 'react'
import type { AgencySettings, Client, ClientEvent, Role } from '../types'

// Shared app state that many screens need, so they can read it without props threaded through App.tsx.
export interface AppContextValue {
  agency: AgencySettings
  setAgency: (patch: Partial<AgencySettings>) => void
  role: Role
  setRole: (role: Role) => void
  addClient: (client: Client) => void
  // Adds a manager decision to the client's memory.
  recordEvent: (clientId: string, event: ClientEvent) => void
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside AppContext')
  return value
}

export const useManagerName = () => useApp().agency.managerName
