/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const { create } = await import('zustand')
    return {
        useAccountsStore: create(() => ({
            selectedAccountId: 'home' as string | null,
            accounts: [] as unknown[],
        })),
    }
})

import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { useSwapsStore } from '../store'
import { watchSelectedAccount } from '../watchSelectedAccount'

describe('swaps/watchSelectedAccount', () => {
    let unsubscribe: () => void

    beforeEach(() => {
        useSwapsStore.getState().resetState()
        useAccountsStore.setState({ selectedAccountId: 'home' })
        unsubscribe = watchSelectedAccount()
        useSwapsStore.getState().setAccountId('picked')
    })

    afterEach(() => unsubscribe())

    test('drops the account picked in Swap when the selection changes', () => {
        useAccountsStore.setState({ selectedAccountId: 'other' })

        expect(useSwapsStore.getState().accountId).toBeNull()
    })

    test('keeps the picked account through accounts-store writes that leave the selection alone', () => {
        useAccountsStore.setState({ accounts: [] })

        expect(useSwapsStore.getState().accountId).toBe('picked')
    })

    test('stops following once unsubscribed', () => {
        unsubscribe()

        useAccountsStore.setState({ selectedAccountId: 'other' })

        expect(useSwapsStore.getState().accountId).toBe('picked')
    })
})
