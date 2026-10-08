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
import { buildTestAccount } from '../../__tests__/accountFactory'
import { accountType } from '../../utils'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'

// Built by hand: buildAccount needs a registered adapter for every chain it
// derives from, and these specs put accounts on Ethereum.
const watchOn = (
    id: string,
    addresses: Partial<Record<'algorand' | 'ethereum', string>>,
): WalletAccount =>
    ({
        id,
        ...(addresses.algorand ? { address: addresses.algorand } : {}),
        custody: { kind: 'watch' },
        chains: Object.fromEntries(
            Object.entries(addresses).map(([chainId, address]) => [
                chainId,
                { address },
            ]),
        ),
    }) as WalletAccount

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
        const { registerFakeAccountsChain } =
            await import('../../__tests__/fakeAccountsChain')
        registerFakeAccountsChain()
        const module = await import('../store')
        useAccountsStore = module.useAccountsStore
    })

    test('defaults to empty list and setAccounts updates state', () => {
        const state = useAccountsStore.getState()
        expect(state.accounts).toEqual([])

        const a1: WalletAccount = {
            id: '1',
            name: 'Alice',
            custody: { kind: 'local', seed: 'algo25' },
            address: 'ALICE-ADDR',
            canSign: true,
        }
        const a2: WalletAccount = {
            id: '2',
            name: 'Bob',
            custody: { kind: 'local', seed: 'algo25' },
            address: 'BOB-ADDR',
            canSign: true,
        }

        useAccountsStore.getState().setAccounts([a1, a2])
        expect(useAccountsStore.getState().accounts).toEqual([a1, a2])

        const a3: WalletAccount = {
            id: '3',
            name: 'Carol',
            custody: { kind: 'local', seed: 'algo25' },
            address: 'CAROL-ADDR',
            canSign: true,
        }
        useAccountsStore.getState().setAccounts([a1, a3])
        expect(useAccountsStore.getState().accounts).toEqual([a1, a3])
    })

    describe('setAccounts duplicate resolution', () => {
        const watchDupe: WalletAccount = {
            id: 'watch',
            name: 'Watched',
            custody: { kind: 'watch' },
            address: 'DUPE-ADDR',
        }
        const hardwareDupe: WalletAccount = {
            id: 'hardware',
            name: 'Ledger',
            custody: {
                kind: 'hardware',
                device: {
                    manufacturer: 'ledger',
                    deviceId: 'dev-1',
                    deviceName: 'Nano X',
                    transportType: 'ble',
                },
                accountIndex: 0,
            },
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
            expect(accounts[0]).toEqual(hardwareDupe)
        })

        test('keeps the higher-precedence type when the watch entry comes last', () => {
            useAccountsStore.getState().setAccounts([hardwareDupe, watchDupe])

            const { accounts } = useAccountsStore.getState()
            expect(accounts).toHaveLength(1)
            expect(accounts[0]).toEqual(hardwareDupe)
        })

        test('places the surviving entry at the first occurrence position', () => {
            const first: WalletAccount = {
                id: '1',
                name: 'First',
                custody: { kind: 'local', seed: 'algo25' },
                address: 'FIRST-ADDR',
                keyPairId: 'kp1',
            }
            const last: WalletAccount = {
                id: '3',
                name: 'Last',
                custody: { kind: 'local', seed: 'algo25' },
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
            expect(accounts[1]).toEqual(hardwareDupe)
        })

        test('keeps the first occurrence when both entries rank equally', () => {
            const a1: WalletAccount = {
                id: '1',
                name: 'Alice',
                custody: { kind: 'local', seed: 'algo25' },
                address: 'DUPE-ADDR',
                keyPairId: 'kp1',
            }
            const a2: WalletAccount = {
                id: '2',
                name: 'Alice copy',
                custody: { kind: 'local', seed: 'algo25' },
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
                    custody: { kind: 'watch' },
                    address: 'A',
                },
                {
                    id: '2',
                    name: 'Bob',
                    custody: { kind: 'local', seed: 'algo25' },
                    address: 'B',
                    keyPairId: 'kp2',
                },
                {
                    id: '3',
                    name: 'Carol',
                    custody: { kind: 'local', seed: 'quantum' },
                    address: 'C',
                    keyPairId: 'kp3',
                },
            ]

            useAccountsStore.getState().setAccounts(accountsIn)

            expect(useAccountsStore.getState().accounts).toEqual(accountsIn)
        })

        test('collapses accounts that share an address on a non-Algorand chain, keeping the higher rank in the first position', () => {
            const watch = watchOn('watch', {
                algorand: 'WATCH-ALGO',
                ethereum: '0xDUPE',
            })
            const hd = {
                id: 'hd',
                address: 'HD-ALGO',
                keyPairId: 'kp-hd',
                hdWalletDetails: { account: 0, keyIndex: 0 },
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
                chains: {
                    algorand: { address: 'HD-ALGO', keyPairId: 'kp-hd' },
                    ethereum: { address: '0xDUPE', keyPairId: 'kp-hd-eth' },
                },
            } as unknown as WalletAccount
            const other = watchOn('other', { algorand: 'OTHER' })

            useAccountsStore.getState().setAccounts([watch, other, hd])

            expect(useAccountsStore.getState().accounts.map(a => a.id)).toEqual(
                ['hd', 'other'],
            )
        })

        test('keeps accounts that share an address only on different chains', () => {
            const onAlgorand = watchOn('algo', { algorand: 'SHARED' })
            const onEthereum = watchOn('eth', { ethereum: 'SHARED' })

            useAccountsStore.getState().setAccounts([onAlgorand, onEthereum])

            expect(useAccountsStore.getState().accounts.map(a => a.id)).toEqual(
                ['algo', 'eth'],
            )
        })
    })

    test('getSelectedAccount returns the selected account', () => {
        const a1: WalletAccount = {
            id: '1',
            name: 'Alice',
            custody: { kind: 'local', seed: 'algo25' },
            address: 'ALICE-ADDR',
            canSign: true,
        }
        const a2: WalletAccount = {
            id: '2',
            name: 'Bob',
            custody: { kind: 'local', seed: 'algo25' },
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
            custody: { kind: 'local', seed: 'algo25' },
            address: 'ALICE-ADDR',
            canSign: true,
        }
        const a2: WalletAccount = {
            id: '2',
            name: 'Bob',
            custody: { kind: 'local', seed: 'algo25' },
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
            custody: { kind: 'local', seed: 'algo25' },
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
            custody: { kind: 'local', seed: 'algo25' },
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
            custody: { kind: 'local', seed: 'algo25' },
            address: 'ALICE-ADDR',
            canSign: true,
        }
        const a2: WalletAccount = {
            id: '2',
            name: 'Bob',
            custody: { kind: 'local', seed: 'algo25' },
            address: 'BOB-ADDR',
            canSign: true,
        }
        const a3: WalletAccount = {
            id: '3',
            name: 'Carol',
            custody: { kind: 'local', seed: 'algo25' },
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
            custody: { kind: 'local', seed: 'algo25' },
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
            custody: { kind: 'local', seed: 'algo25' },
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

    describe('addAccount', () => {
        beforeEach(() => {
            useAccountsStore.getState().resetState()
        })

        test('appends an account whose addresses are free', () => {
            const existing = watchOn('existing', { algorand: 'A' })
            const added = watchOn('added', { algorand: 'B' })
            useAccountsStore.getState().setAccounts([existing])

            useAccountsStore.getState().addAccount(added)

            expect(useAccountsStore.getState().accounts).toEqual([
                existing,
                added,
            ])
        })

        test('throws naming the existing account by id when an address is taken on the same chain', async () => {
            const { DuplicateAccountError } = await import('../../errors')
            const existing = watchOn('existing-id', {
                algorand: 'A',
                ethereum: '0xDUPE',
            })
            useAccountsStore.getState().setAccounts([existing])

            const add = () =>
                useAccountsStore
                    .getState()
                    .addAccount(watchOn('added', { ethereum: '0xDUPE' }))

            expect(add).toThrow(DuplicateAccountError)
            expect(add).toThrow(
                /0xDUPE is already in the wallet as existing-id/,
            )
            expect(useAccountsStore.getState().accounts).toEqual([existing])
        })

        test('accepts an address that an existing account holds only on a different chain', () => {
            const existing = watchOn('existing', { algorand: 'SHARED' })
            const added = watchOn('added', { ethereum: 'SHARED' })
            useAccountsStore.getState().setAccounts([existing])

            useAccountsStore.getState().addAccount(added)

            expect(useAccountsStore.getState().accounts.map(a => a.id)).toEqual(
                ['existing', 'added'],
            )
        })

        test('matches a legacy record with no chains through its Algorand address', async () => {
            const { DuplicateAccountError } = await import('../../errors')
            useAccountsStore.setState({
                accounts: [
                    {
                        id: 'legacy',
                        custody: { kind: 'watch' },
                        address: 'LEGACY',
                    } as WalletAccount,
                ],
            })

            expect(() =>
                useAccountsStore
                    .getState()
                    .addAccount(watchOn('added', { algorand: 'LEGACY' })),
            ).toThrow(DuplicateAccountError)
        })
    })

    describe('addRekeyedWatchAccounts', () => {
        test('adds plain watch accounts and records the source as their authority on the scanned network', async () => {
            useAccountsStore.getState().setAccounts([])

            const added = useAccountsStore
                .getState()
                .addRekeyedWatchAccounts('SRC', ['R1'], 'testnet')

            expect(added).toBe(1)
            const r1 = useAccountsStore.getState().accounts[0]
            expect(r1).not.toHaveProperty('rekeyAddress')
            const { authorityOf } = await import('../../credentials/accessors')
            expect(authorityOf(r1, scopeForLegacyNetwork('testnet'))).toBe(
                'SRC',
            )
            expect(authorityOf(r1, scopeForLegacyNetwork('mainnet'))).toBeNull()
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

        test('replaces a watch account with a hardware account, preserving id and name', () => {
            useAccountsStore.getState().setAccounts([
                {
                    id: 'w1',
                    name: 'My Ledger (watched)',
                    custody: { kind: 'watch' },
                    address: 'WATCHED',
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
                address: 'WATCHED',
                hardwareDetails,
                custody: {
                    kind: 'hardware',
                    device: {
                        manufacturer: 'ledger',
                        deviceId: 'dev-1',
                        deviceName: 'Nano X',
                        transportType: 'ble',
                    },
                    accountIndex: 0,
                },
                chains: { algorand: { address: 'WATCHED' } },
            })
            expect(account).not.toHaveProperty('type')
        })

        test('upgrades a watch account built with its chain entry', () => {
            const watch = buildTestAccount('watch')
            useAccountsStore.getState().setAccounts([watch])

            const upgraded = useAccountsStore
                .getState()
                .upgradeWatchAccountToHardware(watch.address!, hardwareDetails)

            expect(upgraded).toBe(true)
            expect(accountType(useAccountsStore.getState().accounts[0])).toBe(
                'hardware',
            )
        })

        test('refuses to touch a non-watch account', () => {
            useAccountsStore.getState().setAccounts([
                {
                    id: 'h1',
                    custody: { kind: 'local', seed: 'algo25' },
                    address: 'SIGNER',
                    keyPairId: 'kp1',
                } as WalletAccount,
            ])

            const upgraded = useAccountsStore
                .getState()
                .upgradeWatchAccountToHardware('SIGNER', hardwareDetails)

            expect(upgraded).toBe(false)
            expect(accountType(useAccountsStore.getState().accounts[0])).toBe(
                'algo25',
            )
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
            custody: {
                kind: 'hardware',
                device: {
                    manufacturer: 'ledger',
                    deviceId: 'old-device',
                    deviceName: 'Nano X',
                    transportType: 'ble',
                },
                accountIndex: 0,
            },
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
                custody: {
                    kind: 'hardware',
                    device: {
                        manufacturer: 'ledger',
                        deviceId: 'new-device',
                        deviceName: 'Nano X',
                        transportType: 'ble',
                    },
                    accountIndex: 0,
                },
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
                    custody: { kind: 'watch' },
                    address: 'WATCHED',
                } as WalletAccount,
            ])

            const updated = useAccountsStore
                .getState()
                .updateHardwareDetails('WATCHED', staleDetails)

            expect(updated).toBe(false)
            expect(accountType(useAccountsStore.getState().accounts[0])).toBe(
                'watch',
            )
        })
    })

    describe('launch account preference', () => {
        const alice: WalletAccount = {
            id: '1',
            name: 'Alice',
            custody: { kind: 'local', seed: 'algo25' },
            address: 'ALICE-ADDR',
            canSign: true,
        }
        const bob: WalletAccount = {
            id: '2',
            name: 'Bob',
            custody: { kind: 'local', seed: 'algo25' },
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
                version: 3,
            }
            getProvider().keyValueStorage.setItem(
                'accounts-store',
                JSON.stringify(legacyPayload),
            )

            vi.resetModules()
            const module = await import('../store')
            await module.useAccountsStore.persist.rehydrate()

            const state = module.useAccountsStore.getState()
            expect(state.accounts).toEqual([alice, bob])
            expect(state.selectedAccountAddress).toBe('BOB-ADDR')
            expect(state.sortMode).toBe('alphabeticalAsc')
            expect(state.manualAccountOrder).toEqual(['BOB-ADDR', 'ALICE-ADDR'])
            expect(state.launchAccountMode).toBe('lastUsed')
            expect(state.launchAccountAddress).toBeNull()
        })

        test('seeds the chain-state slice from a payload that still carries the authority fields, then drops them', async () => {
            const watch = (id: string, extra: Record<string, unknown>) => ({
                id,
                address: id,
                custody: { kind: 'watch' },
                chains: { algorand: { address: id } },
                ...extra,
            })
            getProvider().keyValueStorage.setItem(
                'accounts-store',
                JSON.stringify({
                    state: {
                        accounts: [
                            watch('MAP-ONLY', {
                                rekeyAddressByNetwork: { testnet: 'T' },
                            }),
                            watch('SCALAR-ONLY', { rekeyAddress: 'S' }),
                            watch('BOTH', {
                                rekeyAddress: 'IGNORED',
                                rekeyAddressByNetwork: { mainnet: 'M' },
                            }),
                        ],
                        selectedAccountAddress: 'MAP-ONLY',
                        sortMode: 'manual',
                        manualAccountOrder: [],
                    },
                    version: 3,
                }),
            )

            vi.resetModules()
            const { registerFakeAccountsChain } =
                await import('../../__tests__/fakeAccountsChain')
            registerFakeAccountsChain()
            const { useNetworkStore } =
                await import('@perawallet/wallet-core-chain-shared')
            useNetworkStore.getState().setNetwork('mainnet')
            const { runMigrations, migrations } =
                await import('@perawallet/wallet-core-database')
            const { createTestDatabase } =
                await import('@perawallet/wallet-core-database/test-utils')
            const { db, teardown } = createTestDatabase()
            await runMigrations(db, migrations)
            const module = await import('../store')
            const { hydrateAccountChainStates } =
                await import('../hydrateAccountChainStates')
            const { authorityOf } = await import('../../credentials/accessors')

            await module.useAccountsStore.persist.rehydrate()
            await hydrateAccountChainStates({ db })

            const [mapOnly, scalarOnly, both] =
                module.useAccountsStore.getState().accounts
            for (const account of [mapOnly, scalarOnly, both]) {
                expect(account).not.toHaveProperty('rekeyAddress')
                expect(account).not.toHaveProperty('rekeyAddressByNetwork')
            }
            const testnet = scopeForLegacyNetwork('testnet')
            const mainnet = scopeForLegacyNetwork('mainnet')
            expect(authorityOf(mapOnly, testnet)).toBe('T')
            expect(authorityOf(mapOnly, mainnet)).toBeNull()
            expect(authorityOf(scalarOnly, mainnet)).toBe('S')
            expect(authorityOf(both, mainnet)).toBe('M')

            module.useAccountsStore.getState().setSortMode('alphabeticalAsc')
            const stored =
                await getProvider().keyValueStorage.getItem('accounts-store')
            expect(stored).not.toContain('rekeyAddress')
            teardown()
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
        const kinds = [
            'algo25',
            'quantum',
            'hdWallet',
            'hardware',
            'multisig',
            'watch',
        ] as const

        // Records as store v0-v2 persisted them: `type` is the legacy kind.
        const legacyAccounts = [
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
        ] as unknown as WalletAccount[]
        const migratedAccounts = [
            {
                id: 'a',
                address: 'ALGO25-ADDR',
                keyPairId: 'seed-ed25519',
                custody: { kind: 'local', seed: 'algo25' },
                chains: {
                    algorand: {
                        address: 'ALGO25-ADDR',
                        keyPairId: 'seed-ed25519',
                    },
                },
            },
            {
                id: 'h',
                address: 'HD-ADDR',
                keyPairId: 'seed-acc0-idx0-dt9',
                hdWalletDetails: {
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9,
                },
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
                chains: {
                    algorand: {
                        address: 'HD-ADDR',
                        keyPairId: 'seed-acc0-idx0-dt9',
                    },
                },
            },
            {
                id: 'w',
                address: 'WATCH-ADDR',
                custody: { kind: 'watch' },
                chains: { algorand: { address: 'WATCH-ADDR' } },
            },
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
                accounts: migratedAccounts,
            })
        })

        test('migrating an already-migrated state changes nothing', async () => {
            const { migrateAccountsState } = await import('../store')
            const once = migrateAccountsState(structuredClone(v0State), 0)

            expect(migrateAccountsState(structuredClone(once), 2)).toEqual(once)
        })

        const v1Accounts = legacyAccounts.map(account => ({
            ...account,
            provenance: { kind: 'stale' },
            credentials: { algorand: { keyPairId: 'stale' } },
        }))

        test('v0 and v1 state migrate to the same current accounts, without the v1 fields', async () => {
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

        test('v1 custody is derived again from the stored type', async () => {
            const { migrateAccountsState } = await import('../store')
            const stale = {
                ...buildTestAccount('hardware'),
                type: 'watch',
                provenance: { kind: 'hardware' },
                credentials: {},
            }

            const [account] = migrateAccountsState(
                { ...v0State, accounts: [stale] },
                1,
            ).accounts

            expect(accountType(account)).toBe('watch')
        })

        // Every persisted record the way v2 stored it, plus the shapes the
        // backfill couldn't give a custody.
        const makeV2Accounts = () =>
            [
                ...kinds.map(kind => ({
                    ...buildTestAccount(kind),
                    type: kind,
                })),
                { id: 'bare-multisig', type: 'multisig', address: 'BARE-MSIG' },
                { id: 'bare-algo25', type: 'algo25', address: 'BARE-ALGO25' },
                {
                    id: 'bare-hd',
                    type: 'hdWallet',
                    address: 'BARE-HD',
                    keyPairId: 'kp',
                },
                { id: 'bare-hardware', type: 'hardware', address: 'BARE-HW' },
                { id: 'no-type', address: 'NO-TYPE' },
                { ...buildTestAccount('hardware'), id: 'liar', type: 'watch' },
            ] as unknown as WalletAccount[]
        const makeV2State = () => {
            const accounts = makeV2Accounts()
            return {
                accounts,
                selectedAccountAddress: 'HDWALLET-ADDR',
                sortMode: 'manual',
                manualAccountOrder: accounts.map(a => a.address),
                launchAccountMode: 'lastUsed',
                launchAccountAddress: null,
            }
        }
        const v2Kinds = [
            ...kinds,
            'multisig',
            'algo25',
            'watch',
            'watch',
            'watch',
            'hardware',
        ]

        test('v2 accounts keep their kind, and none keeps a type', async () => {
            const { migrateAccountsState } = await import('../store')

            const { accounts } = migrateAccountsState(makeV2State(), 2)

            expect(accounts.map(accountType)).toEqual(v2Kinds)
            for (const account of accounts) {
                expect(account).not.toHaveProperty('type')
                expect(account.custody).toBeDefined()
            }
        })

        test('a record the backfill could not decode becomes a read-only watch account', async () => {
            const { migrateAccountsState } = await import('../store')

            const { accounts } = migrateAccountsState(makeV2State(), 2)
            const byId = (id: string) => accounts.find(a => a.id === id)!

            expect(byId('bare-multisig').chains).toEqual({
                algorand: { address: 'BARE-MSIG' },
            })
            expect(byId('bare-algo25').keyPairId).toBeUndefined()
            for (const id of ['bare-hd', 'bare-hardware', 'no-type']) {
                const account = byId(id)
                expect(account.custody).toEqual({ kind: 'watch' })
                expect(account.keyPairId).toBeUndefined()
                expect(account).not.toHaveProperty('hardwareDetails')
            }
        })

        test('rehydrating a v2 payload keeps every account kind and the other fields', async () => {
            getProvider().keyValueStorage.setItem(
                'accounts-store',
                JSON.stringify({ state: makeV2State(), version: 2 }),
            )

            vi.resetModules()
            const module = await import('../store')
            await module.useAccountsStore.persist.rehydrate()

            const state = module.useAccountsStore.getState()
            expect(state.accounts.map(accountType)).toEqual(v2Kinds)
            expect(state.selectedAccountAddress).toBe('HDWALLET-ADDR')
            expect(state.sortMode).toBe('manual')
            expect(state.manualAccountOrder).toEqual(
                makeV2State().manualAccountOrder,
            )
            expect(state.launchAccountMode).toBe('lastUsed')
        })

        test('persisted v3 state is not migrated again', async () => {
            const { migrateAccountsState } = await import('../store')
            const v3State = { ...makeV2State(), accounts: migratedAccounts }

            expect(migrateAccountsState(v3State, 3)).toBe(v3State)
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

            expect(firstState.accounts).toEqual(migratedAccounts)
            expect(second.getState().accounts).toEqual(firstState.accounts)
            expect(second.getState().selectedAccountAddress).toBe('HD-ADDR')
            expect(second.getState().manualAccountOrder).toEqual(
                v0State.manualAccountOrder,
            )
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
        })

        test('upgrading a watch account replaces its watch custody with a hardware one', () => {
            useAccountsStore
                .getState()
                .setAccounts([
                    { id: 'w', custody: { kind: 'watch' }, address: 'WATCHED' },
                ])

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
                    custody: {
                        kind: 'hardware',
                        device: {
                            manufacturer: 'ledger',
                            deviceId: 'device-1',
                            deviceName: 'Nano X',
                            transportType: 'ble',
                        },
                        accountIndex: 0,
                    },
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
