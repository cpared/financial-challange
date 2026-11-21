import { createContext } from 'react'

export interface AccountContextValue {
  readonly userId: number
  readonly setUserId: (userId: number) => void
}

export const AccountContext = createContext<AccountContextValue | null>(null)
