import { createContext, useContext } from 'react'

export interface UIApi {
  notify: (message: string) => void
}

export const UIContext = createContext<UIApi>({ notify: () => {} })
export const useUI = () => useContext(UIContext)

export type Tab = 'dashboard' | 'missions' | 'fleet' | 'market' | 'ledger'

export interface NavApi {
  tab: Tab
  setTab: (t: Tab) => void
  selectedMissionId: string | null
  setSelectedMissionId: (id: string | null) => void
}

export const NavContext = createContext<NavApi>({
  tab: 'dashboard',
  setTab: () => {},
  selectedMissionId: null,
  setSelectedMissionId: () => {},
})
export const useNav = () => useContext(NavContext)
