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
import { act } from '@testing-library/react'
import type { WalletAccount } from '../../models'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

describe('services/accounts/store', () => {
    let useAccountsStore: typeof import('../store').useAccountsStore

    beforeEach(async () => {
        vi.resetModules()
        const module = await import('../store')
        useAccountsStore = module.useAccountsStore
    })

    test('defaults to empty list and setAccounts updates state', () => {
        const state = useAccountsStore.getState()
        expect(state.accounts).toEqual([])

        const a1: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'algo25',
            address: 'ALICE-ADDR',
            canSign: true,
        }
        const a2: WalletAccount = {
            id: '2',
            name: 'Bob',
            type: 'algo25',
            address: 'BOB-ADDR',
            canSign: true,
        }

        useAccountsStore.getState().setAccounts([a1, a2])
        expect(useAccountsStore.getState().accounts).toEqual([a1, a2])

        const a3: WalletAccount = {
            id: '3',
            name: 'Carol',
            type: 'algo25',
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
            type: 'algo25',
            address: 'ALICE-ADDR',
            canSign: true,
        }
        const a2: WalletAccount = {
            id: '2',
            name: 'Bob',
            type: 'algo25',
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

    test('setAccounts selects first remaining account if selected account is removed', () => {
        const a1: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'algo25',
            address: 'ALICE-ADDR',
            canSign: true,
        }
        const a2: WalletAccount = {
            id: '2',
            name: 'Bob',
            type: 'algo25',
            address: 'BOB-ADDR',
            canSign: true,
        }

        useAccountsStore.getState().setAccounts([a1, a2])
        useAccountsStore.getState().setSelectedAccountAddress(a1.address)
        expect(useAccountsStore.getState().selectedAccountAddress).toBe(
            a1.address,
        )

        // Setting new accounts without the selected one should fall back to first remaining
        useAccountsStore.getState().setAccounts([a2])
        expect(useAccountsStore.getState().selectedAccountAddress).toBe(
            a2.address,
        )
    })

    test('setAccounts resets to null when all accounts are removed', () => {
        const a1: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'algo25',
            address: 'ALICE-ADDR',
            canSign: true,
        }

        useAccountsStore.getState().setAccounts([a1])
        useAccountsStore.getState().setSelectedAccountAddress(a1.address)

        useAccountsStore.getState().setAccounts([])
        expect(useAccountsStore.getState().selectedAccountAddress).toBeNull()
    })

    test('setAccounts auto-selects first account when no previous selection', () => {
        const a1: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'algo25',
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
            type: 'algo25',
            address: 'ALICE-ADDR',
            canSign: true,
        }
        const a2: WalletAccount = {
            id: '2',
            name: 'Bob',
            type: 'algo25',
            address: 'BOB-ADDR',
            canSign: true,
        }
        const a3: WalletAccount = {
            id: '3',
            name: 'Carol',
            type: 'algo25',
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
            type: 'algo25',
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

    test('resetState reverts state to initial values', () => {
        const a1: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'algo25',
            address: 'ALICE-ADDR',
            canSign: true,
        }
        useAccountsStore.getState().setAccounts([a1])
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
        expect(useAccountsStore.getState().selectedAccountAddress).toBe(
            a1.address,
        )

        act(() => {
            useAccountsStore.getState().resetState()
        })

        expect(useAccountsStore.getState().accounts).toEqual([])
        expect(useAccountsStore.getState().selectedAccountAddress).toBeNull()
    })

    describe('migrateAccountsState', () => {
        test('strips entropyKeyId and seedKeyId from accounts when migrating from v2 to v3', async () => {
            const { migrateAccountsState } = await import('../store')

            const v2State = {
                accounts: [
                    {
                        id: '1',
                        type: 'hdWallet',
                        address: 'HD1',
                        keyPairId: 'wallet-1',
                        entropyKeyId: 'wallet-1-entropy',
                        hdWalletDetails: {
                            account: 0,
                            change: 0,
                            keyIndex: 0,
                            derivationType: 9,
                        },
                    },
                    {
                        id: '2',
                        type: 'hdWallet',
                        address: 'HD2',
                        keyPairId: 'wallet-1',
                        // sibling that the bug left without entropyKeyId
                        hdWalletDetails: {
                            account: 1,
                            change: 0,
                            keyIndex: 0,
                            derivationType: 9,
                        },
                    },
                    {
                        id: '3',
                        type: 'algo25',
                        address: 'A25',
                        keyPairId: 'wallet-2',
                        seedKeyId: 'wallet-2-seed',
                    },
                ],
                selectedAccountAddress: 'HD1',
                sortMode: 'manual',
                manualAccountOrder: ['HD1', 'HD2', 'A25'],
            }

            const migrated = migrateAccountsState(v2State, 2)

            for (const account of migrated.accounts) {
                expect(account).not.toHaveProperty('entropyKeyId')
                expect(account).not.toHaveProperty('seedKeyId')
            }
            expect(migrated.accounts).toHaveLength(3)
            expect(migrated.accounts[0].keyPairId).toBe('wallet-1')
            expect(migrated.accounts[1].keyPairId).toBe('wallet-1')
            expect(migrated.accounts[2].keyPairId).toBe('wallet-2')
            expect(migrated.selectedAccountAddress).toBe('HD1')
            expect(migrated.sortMode).toBe('manual')
        })

        test('migrates from v1 to v3 in one pass — sets sortMode/manualAccountOrder and strips fields', async () => {
            const { migrateAccountsState } = await import('../store')

            const v1State = {
                accounts: [
                    {
                        id: '1',
                        type: 'hdWallet',
                        address: 'HD1',
                        keyPairId: 'wallet-1',
                        entropyKeyId: 'wallet-1-entropy',
                        hdWalletDetails: {
                            account: 0,
                            change: 0,
                            keyIndex: 0,
                            derivationType: 9,
                        },
                    },
                ],
                selectedAccountAddress: 'HD1',
            }

            const migrated = migrateAccountsState(v1State, 1)

            expect(migrated.sortMode).toBe('manual')
            expect(migrated.manualAccountOrder).toEqual(['HD1'])
            expect(migrated.accounts[0]).not.toHaveProperty('entropyKeyId')
        })

        test('is a no-op when already at the current version', async () => {
            const { migrateAccountsState } = await import('../store')

            const v3State = {
                accounts: [
                    {
                        id: '1',
                        type: 'hdWallet',
                        address: 'HD1',
                        keyPairId: 'wallet-1',
                        hdWalletDetails: {
                            account: 0,
                            change: 0,
                            keyIndex: 0,
                            derivationType: 9,
                        },
                    },
                ],
                selectedAccountAddress: 'HD1',
                sortMode: 'manual',
                manualAccountOrder: ['HD1'],
            }

            const migrated = migrateAccountsState(v3State, 3)

            expect(migrated).toEqual(v3State)
        })
    })

    describe('updateAccountRekeyAddress', () => {
        test('sets rekeyAddress on the matching account', () => {
            useAccountsStore.getState().setAccounts([
                {
                    type: 'watch',
                    address: 'A',
                } as unknown as WalletAccount,
                {
                    type: 'algo25',
                    address: 'B',
                    keyPairId: 'k',
                } as unknown as WalletAccount,
            ])

            useAccountsStore.getState().updateAccountRekeyAddress('A', 'B')

            const accounts = useAccountsStore.getState().accounts
            const a = accounts.find(x => x.address === 'A')!
            expect(a.rekeyAddress).toBe('B')
            expect(
                accounts.find(x => x.address === 'B')?.rekeyAddress,
            ).toBeUndefined()
        })

        test('clears rekeyAddress when passed null', () => {
            useAccountsStore.getState().setAccounts([
                {
                    type: 'algo25',
                    address: 'A',
                    keyPairId: 'k',
                    rekeyAddress: 'B',
                } as unknown as WalletAccount,
            ])

            useAccountsStore.getState().updateAccountRekeyAddress('A', null)
            expect(
                useAccountsStore.getState().accounts[0].rekeyAddress,
            ).toBeUndefined()
        })

        test('is a no-op when the address is not in the store', () => {
            useAccountsStore.getState().setAccounts([
                {
                    type: 'algo25',
                    address: 'A',
                    keyPairId: 'k',
                } as unknown as WalletAccount,
            ])
            const before = useAccountsStore.getState().accounts
            useAccountsStore.getState().updateAccountRekeyAddress('Z', 'Y')
            expect(useAccountsStore.getState().accounts).toBe(before)
        })

        test('does not write when rekeyAddress is unchanged', () => {
            useAccountsStore.getState().setAccounts([
                {
                    type: 'algo25',
                    address: 'A',
                    keyPairId: 'k',
                    rekeyAddress: 'B',
                } as unknown as WalletAccount,
            ])
            const before = useAccountsStore.getState().accounts
            useAccountsStore.getState().updateAccountRekeyAddress('A', 'B')
            expect(useAccountsStore.getState().accounts).toBe(before)
        })
    })
})
