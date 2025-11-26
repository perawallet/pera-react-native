/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { useAccountsStore } from '../index'
import type { WalletAccount } from '../../models'

describe('services/accounts/store', () => {
    beforeEach(() => {
        useAccountsStore.setState({
            accounts: [],
            selectedAccountAddress: null,
        })
    })

    test('defaults to empty list and setAccounts updates state', () => {
        const state = useAccountsStore.getState()
        expect(state.accounts).toEqual([])

        const a1: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'standard',
            address: 'ALICE-ADDR',
            canSign: true,
        }
        const a2: WalletAccount = {
            id: '2',
            name: 'Bob',
            type: 'standard',
            address: 'BOB-ADDR',
            canSign: true,
        }

        useAccountsStore.getState().setAccounts([a1, a2])
        expect(useAccountsStore.getState().accounts).toEqual([a1, a2])

        const a3: WalletAccount = {
            id: '3',
            name: 'Carol',
            type: 'standard',
            address: 'CAROL-ADDR',
            canSign: true,
        }
        useAccountsStore.getState().setAccounts([a1, a3])
        expect(useAccountsStore.getState().accounts).toEqual([a1, a3])
    })

    test('getSelectedAccount returns the selected account', () => {
        const a1: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'standard',
            address: 'ALICE-ADDR',
            canSign: true,
        }
        const a2: WalletAccount = {
            id: '2',
            name: 'Bob',
            type: 'standard',
            address: 'BOB-ADDR',
            canSign: true,
        }

        useAccountsStore.getState().setAccounts([a1, a2])

        // Test default selection (index 0) - logic changed in store implementation?
        // In the new store implementation:
        // if (currentSelected === null && accounts.length) { set({ selectedAccountAddress: accounts.at(0)?.address }) }
        // So it should auto-select the first one.
        expect(useAccountsStore.getState().getSelectedAccount()).toEqual(a1)

        // Test selecting index 1
        useAccountsStore.getState().setSelectedAccountAddress(a2.address)
        expect(useAccountsStore.getState().getSelectedAccount()).toEqual(a2)

        // Test null address
        useAccountsStore.getState().setSelectedAccountAddress(null)
        expect(useAccountsStore.getState().getSelectedAccount()).toBeNull()

        // Test invalid index (out of bounds)
        useAccountsStore
            .getState()
            .setSelectedAccountAddress("someotheraddressthatdoesn'texist")
        expect(useAccountsStore.getState().getSelectedAccount()).toBeNull()
    })

    test('setAccounts resets selectedAccountIndex if selected account is removed', () => {
        const a1: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'standard',
            address: 'ALICE-ADDR',
            canSign: true,
        }
        const a2: WalletAccount = {
            id: '2',
            name: 'Bob',
            type: 'standard',
            address: 'BOB-ADDR',
            canSign: true,
        }

        useAccountsStore.getState().setAccounts([a1, a2])
        useAccountsStore.getState().setSelectedAccountAddress(a1.address)
        expect(useAccountsStore.getState().selectedAccountAddress).toBe(
            a1.address,
        )

        // Setting new accounts without the selected one should reset selection
        useAccountsStore.getState().setAccounts([a2])
        // It should reset to null because the selected account is gone
        expect(useAccountsStore.getState().selectedAccountAddress).toBeNull()
    })
})
