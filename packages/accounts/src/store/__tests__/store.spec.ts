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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { WalletAccount } from '../../models'
import { withCustody } from '../../credentials'
import { buildTestAccount } from '../../__tests__/accountFactory'

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
        expect(useAccountsStore.getState().accounts).toEqual(
            [a1, a2].map(withCustody),
        )

        const a3: WalletAccount = {
            id: '3',
            name: 'Carol',
            type: 'algo25',
            address: 'CAROL-ADDR',
            canSign: true,
        }
        useAccountsStore.getState().setAccounts([a1, a3])
        expect(useAccountsStore.getState().accounts).toEqual(
            [a1, a3].map(withCustody),
        )
    })

    describe('setAccounts duplicate resolution', () => {
        const watchDupe: WalletAccount = {
            id: 'watch',
            name: 'Watched',
            type: 'watch',
            address: 'DUPE-ADDR',
        }
        const hardwareDupe: WalletAccount = {
            id: 'hardware',
            name: 'Ledger',
            type: 'hardware',
            address: 'DUPE-ADDR',
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'dev-1',
                deviceName: 'Nano X',
                accountIndex: 0,
                transportType: 'ble',
            },
        }

        test('keeps the higher-precedence type when the watch entry comes first', () => {
            useAccountsStore.getState().setAccounts([watchDupe, hardwareDupe])

            const { accounts } = useAccountsStore.getState()
            expect(accounts).toHaveLength(1)
            expect(accounts[0]).toEqual(withCustody(hardwareDupe))
        })

        test('keeps the higher-precedence type when the watch entry comes last', () => {
            useAccountsStore.getState().setAccounts([hardwareDupe, watchDupe])

            const { accounts } = useAccountsStore.getState()
            expect(accounts).toHaveLength(1)
            expect(accounts[0]).toEqual(withCustody(hardwareDupe))
        })

        test('places the surviving entry at the first occurrence position', () => {
            const first: WalletAccount = {
                id: '1',
                name: 'First',
                type: 'algo25',
                address: 'FIRST-ADDR',
                keyPairId: 'kp1',
            }
            const last: WalletAccount = {
                id: '3',
                name: 'Last',
                type: 'algo25',
                address: 'LAST-ADDR',
                keyPairId: 'kp3',
            }

            useAccountsStore
                .getState()
                .setAccounts([first, watchDupe, last, hardwareDupe])

            const { accounts } = useAccountsStore.getState()
            expect(accounts.map(a => a.address)).toEqual([
                'FIRST-ADDR',
                'DUPE-ADDR',
                'LAST-ADDR',
            ])
            expect(accounts[1]).toEqual(withCustody(hardwareDupe))
        })

        test('keeps the first occurrence when both entries rank equally', () => {
            const a1: WalletAccount = {
                id: '1',
                name: 'Alice',
                type: 'algo25',
                address: 'DUPE-ADDR',
                keyPairId: 'kp1',
            }
            const a2: WalletAccount = {
                id: '2',
                name: 'Alice copy',
                type: 'algo25',
                address: 'DUPE-ADDR',
                keyPairId: 'kp2',
            }

            useAccountsStore.getState().setAccounts([a1, a2])

            const { accounts } = useAccountsStore.getState()
            expect(accounts).toHaveLength(1)
            expect(accounts[0].id).toBe('1')
        })

        test('returns a duplicate-free list unchanged and in order', () => {
            const accountsIn: WalletAccount[] = [
                {
                    id: '1',
                    name: 'Alice',
                    type: 'watch',
                    address: 'A',
                },
                {
                    id: '2',
                    name: 'Bob',
                    type: 'algo25',
                    address: 'B',
                    keyPairId: 'kp2',
                },
                {
                    id: '3',
                    name: 'Carol',
                    type: 'quantum',
                    address: 'C',
                    keyPairId: 'kp3',
                },
            ]

            useAccountsStore.getState().setAccounts(accountsIn)

            expect(useAccountsStore.getState().accounts).toEqual(
                accountsIn.map(withCustody),
            )
        })
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
        expect(useAccountsStore.getState().getSelectedAccount()).toEqual(
            withCustody(a1),
        )

        // Test selecting index 1
        useAccountsStore.getState().setSelectedAccountAddress(a2.address)
        expect(useAccountsStore.getState().getSelectedAccount()).toEqual(
            withCustody(a2),
        )

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

    describe('updateAccountRekeyAddress', () => {
        test('sets the mirror and the per-network entry for the active network', () => {
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

            useAccountsStore
                .getState()
                .updateAccountRekeyAddress('A', 'B', 'mainnet')

            const accounts = useAccountsStore.getState().accounts
            const a = accounts.find(x => x.address === 'A')!
            expect(a.rekeyAddress).toBe('B')
            expect(a.rekeyAddressByNetwork).toEqual({ mainnet: 'B' })
            expect(
                accounts.find(x => x.address === 'B')?.rekeyAddress,
            ).toBeUndefined()
        })

        test('records an inactive-network sync without touching the mirror', () => {
            useAccountsStore.getState().setAccounts([
                {
                    type: 'algo25',
                    address: 'A',
                    keyPairId: 'k',
                } as unknown as WalletAccount,
            ])
            useAccountsStore.getState().applyNetworkRekeyState('mainnet')

            useAccountsStore
                .getState()
                .updateAccountRekeyAddress('A', 'B', 'testnet')

            const a = useAccountsStore.getState().accounts[0]
            expect(a.rekeyAddress).toBeUndefined()
            expect(a.rekeyAddressByNetwork).toEqual({ testnet: 'B' })
        })

        test('clears the mirror and the network entry when passed null', () => {
            useAccountsStore.getState().setAccounts([
                {
                    type: 'algo25',
                    address: 'A',
                    keyPairId: 'k',
                    rekeyAddress: 'B',
                    rekeyAddressByNetwork: { mainnet: 'B' },
                } as unknown as WalletAccount,
            ])

            useAccountsStore
                .getState()
                .updateAccountRekeyAddress('A', null, 'mainnet')

            const a = useAccountsStore.getState().accounts[0]
            expect(a.rekeyAddress).toBeUndefined()
            // The (empty) map stays: it records "per-network state is known",
            // which gates the legacy-scalar fallback on network switches.
            expect(a.rekeyAddressByNetwork).toEqual({})
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
            useAccountsStore
                .getState()
                .updateAccountRekeyAddress('Z', 'Y', 'mainnet')
            expect(useAccountsStore.getState().accounts).toBe(before)
        })

        test('does not write when the value is unchanged for that network', () => {
            useAccountsStore.getState().setAccounts([
                {
                    type: 'algo25',
                    address: 'A',
                    keyPairId: 'k',
                    rekeyAddress: 'B',
                    rekeyAddressByNetwork: { mainnet: 'B' },
                } as unknown as WalletAccount,
            ])
            const before = useAccountsStore.getState().accounts
            useAccountsStore
                .getState()
                .updateAccountRekeyAddress('A', 'B', 'mainnet')
            expect(useAccountsStore.getState().accounts).toBe(before)
        })
    })

    describe('per-network rekey state on network switch', () => {
        test('mirrors flip in both directions when the network changes (mainnet-rekeyed, testnet-clean)', () => {
            useAccountsStore.getState().setAccounts([
                {
                    type: 'algo25',
                    address: 'A',
                    keyPairId: 'k',
                } as unknown as WalletAccount,
            ])
            useAccountsStore
                .getState()
                .updateAccountRekeyAddress('A', 'AUTH', 'mainnet')
            useAccountsStore
                .getState()
                .updateAccountRekeyAddress('A', null, 'testnet')

            useAccountsStore.getState().applyNetworkRekeyState('testnet')
            expect(
                useAccountsStore.getState().accounts[0].rekeyAddress,
            ).toBeUndefined()

            useAccountsStore.getState().applyNetworkRekeyState('mainnet')
            expect(useAccountsStore.getState().accounts[0].rekeyAddress).toBe(
                'AUTH',
            )
        })

        test('an account with per-network state but no entry for the new network reads as not rekeyed', () => {
            useAccountsStore.getState().setAccounts([
                {
                    type: 'algo25',
                    address: 'A',
                    keyPairId: 'k',
                } as unknown as WalletAccount,
            ])
            useAccountsStore
                .getState()
                .updateAccountRekeyAddress('A', 'AUTH', 'mainnet')

            useAccountsStore.getState().applyNetworkRekeyState('testnet')

            expect(
                useAccountsStore.getState().accounts[0].rekeyAddress,
            ).toBeUndefined()
        })

        test('a legacy account with no per-network state keeps its mirror across switches', () => {
            // Pre-upgrade persisted account: scalar only. Until a sync tick
            // writes the map, the mirror must not be cleared by a switch —
            // single-network usage keeps today's behavior exactly.
            useAccountsStore.getState().setAccounts([
                {
                    type: 'algo25',
                    address: 'A',
                    keyPairId: 'k',
                    rekeyAddress: 'AUTH',
                } as unknown as WalletAccount,
            ])

            useAccountsStore.getState().applyNetworkRekeyState('testnet')

            expect(useAccountsStore.getState().accounts[0].rekeyAddress).toBe(
                'AUTH',
            )
        })

        test('applyNetworkRekeyState leaves state referentially unchanged when nothing differs', () => {
            useAccountsStore.getState().setAccounts([
                {
                    type: 'algo25',
                    address: 'A',
                    keyPairId: 'k',
                } as unknown as WalletAccount,
            ])
            const before = useAccountsStore.getState().accounts

            useAccountsStore.getState().applyNetworkRekeyState('testnet')

            expect(useAccountsStore.getState().accounts).toBe(before)
        })
    })

    describe('addRekeyedWatchAccounts', () => {
        test('stamps new watch accounts with the scanned network entry and mirror', () => {
            useAccountsStore.getState().setAccounts([])

            const added = useAccountsStore
                .getState()
                .addRekeyedWatchAccounts('SRC', ['R1'], 'mainnet')

            expect(added).toBe(1)
            const r1 = useAccountsStore.getState().accounts[0]
            expect(r1.rekeyAddress).toBe('SRC')
            expect(r1.rekeyAddressByNetwork).toEqual({ mainnet: 'SRC' })
        })
    })

    describe('upgradeWatchAccountToHardware', () => {
        const hardwareDetails = {
            manufacturer: 'ledger' as const,
            deviceId: 'dev-1',
            deviceName: 'Nano X',
            accountIndex: 0,
            transportType: 'ble' as const,
        }

        test('replaces a watch account with a hardware account, preserving id, name and rekey state', () => {
            useAccountsStore.getState().setAccounts([
                {
                    id: 'w1',
                    name: 'My Ledger (watched)',
                    type: 'watch',
                    address: 'WATCHED',
                    rekeyAddress: 'AUTH',
                    rekeyAddressByNetwork: { mainnet: 'AUTH' },
                } as WalletAccount,
            ])

            const upgraded = useAccountsStore
                .getState()
                .upgradeWatchAccountToHardware('WATCHED', hardwareDetails)

            expect(upgraded).toBe(true)
            const account = useAccountsStore.getState().accounts[0]
            expect(account).toEqual({
                id: 'w1',
                name: 'My Ledger (watched)',
                type: 'hardware',
                address: 'WATCHED',
                rekeyAddress: 'AUTH',
                rekeyAddressByNetwork: { mainnet: 'AUTH' },
                hardwareDetails,
                custody: expect.objectContaining({ kind: 'hardware' }),
                chains: { algorand: { address: 'WATCHED' } },
            })
        })

        test('refuses to touch a non-watch account', () => {
            useAccountsStore.getState().setAccounts([
                {
                    id: 'h1',
                    type: 'algo25',
                    address: 'SIGNER',
                    keyPairId: 'kp1',
                } as WalletAccount,
            ])

            const upgraded = useAccountsStore
                .getState()
                .upgradeWatchAccountToHardware('SIGNER', hardwareDetails)

            expect(upgraded).toBe(false)
            expect(useAccountsStore.getState().accounts[0].type).toBe('algo25')
        })

        test('is a no-op for an unknown address', () => {
            useAccountsStore.getState().setAccounts([])

            const upgraded = useAccountsStore
                .getState()
                .upgradeWatchAccountToHardware('MISSING', hardwareDetails)

            expect(upgraded).toBe(false)
            expect(useAccountsStore.getState().accounts).toEqual([])
        })
    })

    describe('updateHardwareDetails', () => {
        const staleDetails = {
            manufacturer: 'ledger' as const,
            deviceId: 'old-device',
            deviceName: 'Nano X',
            accountIndex: 0,
            transportType: 'ble' as const,
        }
        const account = {
            id: 'hw1',
            name: 'Ledger 1',
            type: 'hardware',
            address: 'HW',
            hardwareDetails: staleDetails,
        } as WalletAccount

        test('re-binds the stored details when the device id changes', () => {
            useAccountsStore.getState().setAccounts([account])

            const updated = useAccountsStore
                .getState()
                .updateHardwareDetails('HW', {
                    ...staleDetails,
                    deviceId: 'new-device',
                })

            expect(updated).toBe(true)
            const stored = useAccountsStore.getState().accounts[0]
            expect(stored).toMatchObject({
                type: 'hardware',
                hardwareDetails: { deviceId: 'new-device' },
            })
            expect(stored.name).toBe('Ledger 1')
            expect(useAccountsStore.getState().accounts).toHaveLength(1)
        })

        test('is a no-op when the details are unchanged', () => {
            useAccountsStore.getState().setAccounts([account])

            const updated = useAccountsStore
                .getState()
                .updateHardwareDetails('HW', { ...staleDetails })

            expect(updated).toBe(false)
        })

        test('refuses to touch a non-hardware account', () => {
            useAccountsStore.getState().setAccounts([
                {
                    id: 'w1',
                    type: 'watch',
                    address: 'WATCHED',
                } as WalletAccount,
            ])

            const updated = useAccountsStore
                .getState()
                .updateHardwareDetails('WATCHED', staleDetails)

            expect(updated).toBe(false)
            expect(useAccountsStore.getState().accounts[0].type).toBe('watch')
        })
    })

    describe('launch account preference', () => {
        const alice: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'algo25',
            address: 'ALICE-ADDR',
            canSign: true,
        }
        const bob: WalletAccount = {
            id: '2',
            name: 'Bob',
            type: 'algo25',
            address: 'BOB-ADDR',
            canSign: true,
        }

        beforeEach(() => {
            // The mock persist storage outlives vi.resetModules(), so a pin set
            // by an earlier test rehydrates into this one. Every assertion here
            // is about a transition from a known state, so reset explicitly.
            useAccountsStore.getState().resetState()
            useAccountsStore.getState().setAccounts([alice, bob])
        })

        test('defaults to lastUsed with no pinned address', () => {
            const { launchAccountMode, launchAccountAddress } =
                useAccountsStore.getState()

            expect(launchAccountMode).toBe('lastUsed')
            expect(launchAccountAddress).toBeNull()
        })

        test('pins a specific account', () => {
            useAccountsStore
                .getState()
                .setLaunchAccountPreference('specific', 'BOB-ADDR')

            const { launchAccountMode, launchAccountAddress } =
                useAccountsStore.getState()
            expect(launchAccountMode).toBe('specific')
            expect(launchAccountAddress).toBe('BOB-ADDR')
        })

        test('refuses to pin an address that is not a known account', () => {
            useAccountsStore
                .getState()
                .setLaunchAccountPreference('specific', 'GHOST-ADDR')

            const { launchAccountMode, launchAccountAddress } =
                useAccountsStore.getState()
            expect(launchAccountMode).toBe('lastUsed')
            expect(launchAccountAddress).toBeNull()
        })

        test('refuses to pin specific mode with no address at all', () => {
            useAccountsStore.getState().setLaunchAccountPreference('specific')

            expect(useAccountsStore.getState().launchAccountMode).toBe(
                'lastUsed',
            )
        })

        test('switching back to lastUsed clears the pinned address', () => {
            useAccountsStore
                .getState()
                .setLaunchAccountPreference('specific', 'BOB-ADDR')

            useAccountsStore.getState().setLaunchAccountPreference('lastUsed')

            const { launchAccountMode, launchAccountAddress } =
                useAccountsStore.getState()
            expect(launchAccountMode).toBe('lastUsed')
            expect(launchAccountAddress).toBeNull()
        })

        test('reverts to lastUsed when the pinned account is removed', () => {
            useAccountsStore
                .getState()
                .setLaunchAccountPreference('specific', 'BOB-ADDR')

            useAccountsStore.getState().setAccounts([alice])

            const { launchAccountMode, launchAccountAddress } =
                useAccountsStore.getState()
            expect(launchAccountMode).toBe('lastUsed')
            expect(launchAccountAddress).toBeNull()
        })

        test('keeps the pin when an unrelated account is removed', () => {
            useAccountsStore
                .getState()
                .setLaunchAccountPreference('specific', 'BOB-ADDR')

            useAccountsStore.getState().setAccounts([bob])

            const { launchAccountMode, launchAccountAddress } =
                useAccountsStore.getState()
            expect(launchAccountMode).toBe('specific')
            expect(launchAccountAddress).toBe('BOB-ADDR')
        })

        test('applyLaunchAccountPreference selects the pinned account', () => {
            useAccountsStore.getState().setSelectedAccountAddress('ALICE-ADDR')
            useAccountsStore
                .getState()
                .setLaunchAccountPreference('specific', 'BOB-ADDR')

            useAccountsStore.getState().applyLaunchAccountPreference()

            expect(useAccountsStore.getState().selectedAccountAddress).toBe(
                'BOB-ADDR',
            )
        })

        test('applyLaunchAccountPreference leaves lastUsed selection alone', () => {
            useAccountsStore.getState().setSelectedAccountAddress('BOB-ADDR')

            useAccountsStore.getState().applyLaunchAccountPreference()

            expect(useAccountsStore.getState().selectedAccountAddress).toBe(
                'BOB-ADDR',
            )
        })

        // The launch fields were added without bumping the persist version, on
        // the theory that zustand's default shallow merge leaves absent keys at
        // their initial-state values. This asserts that rather than trusting
        // it: seed storage with exactly what a pre- build wrote, and
        // require the upgrade to be a no-op for existing users.
        test('rehydrates a pre-launch-preference payload without a migration', async () => {
            const legacyPayload = {
                state: {
                    accounts: [alice, bob],
                    selectedAccountAddress: 'BOB-ADDR',
                    sortMode: 'alphabeticalAsc',
                    manualAccountOrder: ['BOB-ADDR', 'ALICE-ADDR'],
                },
                version: 0,
            }
            getProvider().keyValueStorage.setItem(
                'accounts-store',
                JSON.stringify(legacyPayload),
            )

            vi.resetModules()
            const module = await import('../store')
            await module.useAccountsStore.persist.rehydrate()

            const state = module.useAccountsStore.getState()
            expect(state.accounts).toEqual([alice, bob].map(withCustody))
            expect(state.selectedAccountAddress).toBe('BOB-ADDR')
            expect(state.sortMode).toBe('alphabeticalAsc')
            expect(state.manualAccountOrder).toEqual(['BOB-ADDR', 'ALICE-ADDR'])
            expect(state.launchAccountMode).toBe('lastUsed')
            expect(state.launchAccountAddress).toBeNull()
        })

        test('applyLaunchAccountPreference ignores a pin that no longer resolves', () => {
            // Reaches past setLaunchAccountPreference's guard to simulate state
            // rehydrated from a build where the account still existed.
            useAccountsStore.setState({
                launchAccountMode: 'specific',
                launchAccountAddress: 'GHOST-ADDR',
                selectedAccountAddress: 'ALICE-ADDR',
            })

            useAccountsStore.getState().applyLaunchAccountPreference()

            expect(useAccountsStore.getState().selectedAccountAddress).toBe(
                'ALICE-ADDR',
            )
        })
    })

    describe('custody', () => {
        const legacyAccounts: WalletAccount[] = [
            {
                id: 'a',
                type: 'algo25',
                address: 'ALGO25-ADDR',
                keyPairId: 'seed-ed25519',
            },
            {
                id: 'h',
                type: 'hdWallet',
                address: 'HD-ADDR',
                keyPairId: 'seed-acc0-idx0-dt9',
                hdWalletDetails: {
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9,
                },
            },
            { id: 'w', type: 'watch', address: 'WATCH-ADDR' },
        ]
        const v0State = {
            accounts: legacyAccounts,
            selectedAccountAddress: 'HD-ADDR',
            sortMode: 'alphabeticalAsc',
            manualAccountOrder: ['HD-ADDR', 'ALGO25-ADDR', 'WATCH-ADDR'],
            launchAccountMode: 'specific',
            launchAccountAddress: 'HD-ADDR',
        }

        test('migrating a v0 state backfills every account and keeps the other fields', async () => {
            const { migrateAccountsState } = await import('../store')

            const migrated = migrateAccountsState(structuredClone(v0State), 0)

            expect(migrated).toEqual({
                ...v0State,
                accounts: legacyAccounts.map(withCustody),
            })
        })

        test('migrating an already-migrated state changes nothing', async () => {
            const { migrateAccountsState } = await import('../store')
            const once = migrateAccountsState(structuredClone(v0State), 0)

            expect(migrateAccountsState(structuredClone(once), 0)).toEqual(once)
        })

        const v1Accounts = legacyAccounts.map(account => ({
            ...withCustody(account),
            provenance: { kind: 'stale' },
            credentials: { algorand: { keyPairId: 'stale' } },
        }))

        test('v0 and v1 state migrate to the same v2 accounts, without the v1 fields', async () => {
            const { migrateAccountsState } = await import('../store')

            const fromV0 = migrateAccountsState(structuredClone(v0State), 0)
            const fromV1 = migrateAccountsState(
                structuredClone({ ...v0State, accounts: v1Accounts }),
                1,
            )

            expect(fromV1.accounts).toEqual(fromV0.accounts)
            for (const account of fromV1.accounts) {
                expect(account).not.toHaveProperty('provenance')
                expect(account).not.toHaveProperty('credentials')
            }
        })

        test('a malformed v1 record keeps its legacy fields and gets no custody', async () => {
            const { migrateAccountsState } = await import('../store')
            const malformed = {
                id: 'm',
                type: 'multisig',
                address: 'MSIG-ADDR',
                provenance: { kind: 'multisig' },
                credentials: {},
            }

            const [account] = migrateAccountsState(
                { ...v0State, accounts: [malformed] },
                1,
            ).accounts

            expect(account).toEqual({
                id: 'm',
                type: 'multisig',
                address: 'MSIG-ADDR',
            })
        })

        test('persisted v2 state is not migrated again', async () => {
            const { migrateAccountsState } = await import('../store')
            const v2State = {
                ...v0State,
                accounts: legacyAccounts.map(withCustody),
            }

            expect(migrateAccountsState(v2State, 2)).toBe(v2State)
        })

        test('hydrating a v0 payload twice yields identical state', async () => {
            getProvider().keyValueStorage.setItem(
                'accounts-store',
                JSON.stringify({ state: v0State, version: 0 }),
            )

            vi.resetModules()
            const first = (await import('../store')).useAccountsStore
            await first.persist.rehydrate()
            const firstState = first.getState()

            vi.resetModules()
            const second = (await import('../store')).useAccountsStore
            await second.persist.rehydrate()

            expect(firstState.accounts).toEqual(legacyAccounts.map(withCustody))
            expect(second.getState().accounts).toEqual(firstState.accounts)
            expect(second.getState().selectedAccountAddress).toBe('HD-ADDR')
            expect(second.getState().manualAccountOrder).toEqual(
                v0State.manualAccountOrder,
            )
        })

        test('setAccounts backfills an account written without custody', () => {
            useAccountsStore.getState().setAccounts([legacyAccounts[0]])

            const [account] = useAccountsStore.getState().accounts
            expect(account.custody).toEqual({ kind: 'local', seed: 'algo25' })
            expect(account.chains).toEqual({
                algorand: { address: 'ALGO25-ADDR', keyPairId: 'seed-ed25519' },
            })
        })

        test('setAccounts keeps the custody an account was built with', () => {
            const accounts = (
                [
                    'algo25',
                    'quantum',
                    'hdWallet',
                    'hardware',
                    'multisig',
                    'watch',
                ] as const
            ).map(type => buildTestAccount(type))

            useAccountsStore.getState().setAccounts(accounts)

            expect(useAccountsStore.getState().accounts).toEqual(accounts)
        })

        test('addRekeyedWatchAccounts writes a watch custody with just the address', () => {
            useAccountsStore.getState().setAccounts([])

            useAccountsStore
                .getState()
                .addRekeyedWatchAccounts('SRC', ['R1'], 'testnet')

            const [account] = useAccountsStore.getState().accounts
            expect(account.custody).toEqual({ kind: 'watch' })
            expect(account.chains).toEqual({ algorand: { address: 'R1' } })
            expect(account.rekeyAddressByNetwork).toEqual({ testnet: 'SRC' })
        })

        test('upgrading a watch account replaces its watch custody with a hardware one', () => {
            useAccountsStore
                .getState()
                .setAccounts([{ id: 'w', type: 'watch', address: 'WATCHED' }])

            useAccountsStore
                .getState()
                .upgradeWatchAccountToHardware('WATCHED', {
                    manufacturer: 'ledger',
                    deviceId: 'dev-1',
                    deviceName: 'Nano X',
                    accountIndex: 3,
                    transportType: 'ble',
                })

            const [account] = useAccountsStore.getState().accounts
            expect(account.custody).toEqual({
                kind: 'hardware',
                device: {
                    manufacturer: 'ledger',
                    deviceId: 'dev-1',
                    deviceName: 'Nano X',
                    transportType: 'ble',
                },
                accountIndex: 3,
            })
            expect(account.chains).toEqual({ algorand: { address: 'WATCHED' } })
        })

        test('re-binding hardware details updates the hardware custody', () => {
            const details = {
                manufacturer: 'ledger' as const,
                deviceId: 'old-device',
                deviceName: 'Nano X',
                accountIndex: 0,
                transportType: 'ble' as const,
            }
            useAccountsStore.getState().setAccounts([
                {
                    id: 'hw',
                    type: 'hardware',
                    address: 'HW',
                    hardwareDetails: details,
                },
            ])

            useAccountsStore
                .getState()
                .updateHardwareDetails('HW', { ...details, deviceId: 'new' })

            expect(useAccountsStore.getState().accounts[0].custody).toEqual({
                kind: 'hardware',
                device: {
                    manufacturer: 'ledger',
                    deviceId: 'new',
                    deviceName: 'Nano X',
                    transportType: 'ble',
                },
                accountIndex: 0,
            })
        })
    })
})
