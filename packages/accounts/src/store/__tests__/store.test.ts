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

// Stateful network-store fake: the accounts store mirrors each account's
// active-network rekey address and re-derives it when the network changes.
const fakeNetwork = vi.hoisted(() => {
    const listeners: Array<(state: unknown, prev: unknown) => void> = []
    const holder = {
        current: 'mainnet',
        listeners,
        switchTo(network: string) {
            const prev = holder.current
            holder.current = network
            for (const cb of [...listeners]) {
                cb({ network }, { network: prev })
            }
        },
    }
    return holder
})

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetworkStore: {
        getState: () => ({ network: fakeNetwork.current }),
        subscribe: (cb: (state: unknown, prev: unknown) => void) => {
            fakeNetwork.listeners.push(cb)
            return () => {}
        },
    },
}))

describe('services/accounts/store', () => {
    let useAccountsStore: typeof import('../store').useAccountsStore

    beforeEach(async () => {
        vi.resetModules()
        fakeNetwork.current = 'mainnet'
        fakeNetwork.listeners.length = 0
        const module = await import('../store')
        useAccountsStore = module.useAccountsStore
        // Installs the network-switch subscription against the fake above.
        await import('../network-rekey-sync')
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

    test('dedupes accounts by address, keeping the first occurrence', () => {
        const a1: WalletAccount = {
            id: '1',
            name: 'Alice',
            type: 'algo25',
            address: 'DUPE-ADDR',
            canSign: true,
        }
        const a2: WalletAccount = {
            id: '2',
            name: 'Alice copy',
            type: 'algo25',
            address: 'DUPE-ADDR',
            canSign: true,
        }

        useAccountsStore.getState().setAccounts([a1, a2])

        const { accounts } = useAccountsStore.getState()
        expect(accounts).toHaveLength(1)
        expect(accounts[0].id).toBe('1')
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

            act(() => {
                fakeNetwork.switchTo('testnet')
            })
            expect(
                useAccountsStore.getState().accounts[0].rekeyAddress,
            ).toBeUndefined()

            act(() => {
                fakeNetwork.switchTo('mainnet')
            })
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

            act(() => {
                fakeNetwork.switchTo('testnet')
            })

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

            act(() => {
                fakeNetwork.switchTo('testnet')
            })

            expect(useAccountsStore.getState().accounts[0].rekeyAddress).toBe(
                'AUTH',
            )
        })

        test('rekeyed/signable derivation follows the network switch', async () => {
            const { isRekeyedAccount, canSignWith } =
                await import('../../utils')
            useAccountsStore.getState().setAccounts([
                {
                    type: 'algo25',
                    address: 'A',
                    keyPairId: 'k',
                } as unknown as WalletAccount,
            ])
            useAccountsStore.getState().applyNetworkRekeyState('mainnet')
            // Rekeyed on mainnet to an external (not-in-wallet) auth.
            useAccountsStore
                .getState()
                .updateAccountRekeyAddress('A', 'EXTERNAL', 'mainnet')
            useAccountsStore
                .getState()
                .updateAccountRekeyAddress('A', null, 'testnet')

            const onMainnet = useAccountsStore.getState().accounts[0]
            expect(isRekeyedAccount(onMainnet)).toBe(true)
            expect(canSignWith(onMainnet, [onMainnet])).toBe(false)

            act(() => {
                fakeNetwork.switchTo('testnet')
            })

            const onTestnet = useAccountsStore.getState().accounts[0]
            expect(isRekeyedAccount(onTestnet)).toBe(false)
            expect(canSignWith(onTestnet, [onTestnet])).toBe(true)
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
            expect(
                stored.type === 'hardware' &&
                    stored.hardwareDetails.deviceId === 'new-device',
            ).toBe(true)
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
})
