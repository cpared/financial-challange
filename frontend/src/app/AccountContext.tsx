import { useState } from 'react'
import type { ReactNode } from 'react'
import { AccountContext } from './account-context'
const accountStorageKey = 'cocos-challenge-user-id-v2'
const defaultUserId = 2

function initialUserId(): number {
  const stored = Number(window.localStorage.getItem(accountStorageKey))
  return Number.isInteger(stored) && stored > 0 ? stored : defaultUserId
}

export function AccountProvider({ children }: { readonly children: ReactNode }) {
  const [userId, setCurrentUserId] = useState(initialUserId)

  function setUserId(nextUserId: number) {
    setCurrentUserId(nextUserId)
    window.localStorage.setItem(accountStorageKey, String(nextUserId))
  }

  return (
    <AccountContext.Provider value={{ userId, setUserId }}>
      {children}
    </AccountContext.Provider>
  )
}
