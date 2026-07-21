import { createContext, useContext } from 'react'

export interface UIApi {
  notify: (message: string) => void
}

export const UIContext = createContext<UIApi>({ notify: () => {} })
export const useUI = () => useContext(UIContext)
