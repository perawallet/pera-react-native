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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { createAccountsStore } from '../index'
import type { WalletAccount } from '../../models'
import type { KeyValueStorageService } from '@perawallet/wallet-core-platform-integration'

describe('services/accounts/store', () => {
    let useAccountsStore: ReturnType<typeof createAccountsStore>

    beforeEach(() => {
        const mockStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        } as unknown as KeyValueStorageService

        useAccountsStore = createAccountsStore(mockStorage)
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

        // Test default selection (index 0)
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

    test('setAccounts auto-selects first account when no previous selection', () => {
        const a1: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'standard',
            address: 'ALICE-ADDR',
            canSign: true,
        }

        // Start with no selection
        expect(useAccountsStore.getState().selectedAccountAddress).toBeNull()

        // Setting accounts should auto-select the first one
        useAccountsStore.getState().setAccounts([a1])
        expect(useAccountsStore.getState().selectedAccountAddress).toBe(
            a1.address,
        )
    })

    test('setAccounts preserves selection when selected account still exists', () => {
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
        const a3: WalletAccount = {
            id: '3',
            name: 'Carol',
            type: 'standard',
            address: 'CAROL-ADDR',
            canSign: true,
        }

        useAccountsStore.getState().setAccounts([a1, a2])
        useAccountsStore.getState().setSelectedAccountAddress(a2.address)

        // Update accounts but keep a2
        useAccountsStore.getState().setAccounts([a2, a3])
        expect(useAccountsStore.getState().selectedAccountAddress).toBe(
            a2.address,
        )
    })

    test('setSelectedAccountAddress sets the address directly', () => {
        const a1: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'standard',
            address: 'ALICE-ADDR',
            canSign: true,
        }

        useAccountsStore.getState().setAccounts([a1])

        // Set a specific address
        useAccountsStore.getState().setSelectedAccountAddress('ALICE-ADDR')
        expect(useAccountsStore.getState().selectedAccountAddress).toBe(
            'ALICE-ADDR',
        )

        // Set to null
        useAccountsStore.getState().setSelectedAccountAddress(null)
        expect(useAccountsStore.getState().selectedAccountAddress).toBeNull()
    })

    test('handles empty accounts array', () => {
        useAccountsStore.getState().setAccounts([])
        expect(useAccountsStore.getState().accounts).toEqual([])
        expect(useAccountsStore.getState().getSelectedAccount()).toBeNull()
    })

    test('getSelectedAccount returns null when accounts is empty', () => {
        useAccountsStore.getState().setSelectedAccountAddress('NON-EXISTENT')
        expect(useAccountsStore.getState().getSelectedAccount()).toBeNull()
    })
})

