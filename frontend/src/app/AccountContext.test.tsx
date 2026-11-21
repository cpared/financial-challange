import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAccount } from './useAccount'
import { AccountProvider } from './AccountContext'

function CurrentAccount() {
  const { userId } = useAccount()
  return <output aria-label="Cuenta seleccionada">{userId}</output>
}

describe('AccountProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('starts on the seeded account with a valid portfolio', () => {
    window.localStorage.setItem('cocos-challenge-user-id', '1')

    render(
      <AccountProvider>
        <CurrentAccount />
      </AccountProvider>,
    )

    expect(screen.getByLabelText('Cuenta seleccionada')).toHaveTextContent('2')
  })
})
