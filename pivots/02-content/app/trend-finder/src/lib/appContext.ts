import { createContext, useContext } from 'react'
import type { Account } from './auth'
import type { AgencySettings, Client, ClientEvent, Role } from '../types'

// Shared app state that many screens need, so they can read it without props threaded through App.tsx.
export interface AppContextValue {
  agency: AgencySettings
  // The signed-in account (null in the demo, which has no accounts).
  account: Account | null
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

// The approver's name as set in Settings. Until one is set the UI says "your approver", so no made-up person shows.
export const NO_APPROVER = 'your approver'
export const useManagerName = () => useApp().agency.managerName.trim() || NO_APPROVER
export const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
