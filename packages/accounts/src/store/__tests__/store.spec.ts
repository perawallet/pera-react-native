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
import type { AccountChains, WalletAccount } from '../../models'
import { toScopeKey } from '@perawallet/wallet-core-chain-contract'
import {
    MAINNET_SCOPE,
    TESTNET_SCOPE,
    type FakeAccountsChain,
} from '../../__tests__/fakeAccountsChain'
import {
    buildTestAccount,
    TEST_CUSTODY,
    testAccount,
    type TestCustody,
} from '../../__tests__/accountFactory'

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

const STORE_KEY = 'accounts-store'

const account = (
    custody: TestCustody,
    address: string,
    overrides: Partial<WalletAccount> = {},
): WalletAccount => testAccount(custody, address, { id: address, ...overrides })

const on = (
    custody: TestCustody,
    id: string,
    chains: AccountChains,
): WalletAccount => buildTestAccount(TEST_CUSTODY[custody], chains, { id })

const hardwareDetails = {
    ...TEST_CUSTODY.hardware.device,
    accountIndex: 0,
}

describe('services/accounts/store', () => {
    let useAccountsStore: typeof import('../store').useAccountsStore
    let fake: FakeAccountsChain

    // The store reads the registry its own module graph imports, so both are
    // re-imported together after every reset.
    const loadStore = async () => {
        vi.resetModules()
        const { registerFakeAccountsChain } =
            await import('../../__tests__/fakeAccountsChain')
        fake = registerFakeAccountsChain()
        const module = await import('../store')
        useAccountsStore = module.useAccountsStore
        return module
    }

    beforeEach(async () => {
        getProvider().keyValueStorage.removeItem(STORE_KEY)
        await loadStore()
    })

    test('defaults to an empty list, and setAccounts replaces it', () => {
        expect(useAccountsStore.getState().accounts).toEqual([])
        const a1 = account('local', 'A')
        const a2 = account('local', 'B')
        const a3 = account('local', 'C')

        useAccountsStore.getState().setAccounts([a1, a2])
        expect(useAccountsStore.getState().accounts).toEqual([a1, a2])

        useAccountsStore.getState().setAccounts([a1, a3])
        expect(useAccountsStore.getState().accounts).toEqual([a1, a3])
    })

    describe('setAccounts duplicate resolution', () => {
        // Ranks come from the chain's `duplicateRank`: the fake ranks
        // hardware > local > multisig > watch.
        test.each([
            ['watch', 'hardware'],
            ['watch', 'local'],
            ['watch', 'hd'],
            ['watch', 'multisig'],
            ['multisig', 'local'],
            ['local', 'hardware'],
        ] as const)(
            'a %s and a %s account on one address: the higher rank survives in either order',
            (lower, higher) => {
                const loser = account(lower, 'DUPE', { id: 'loser' })
                const winner = account(higher, 'DUPE', { id: 'winner' })

                for (const order of [
                    [loser, winner],
                    [winner, loser],
                ]) {
                    useAccountsStore.getState().setAccounts(order)

                    expect(useAccountsStore.getState().accounts).toEqual([
                        winner,
                    ])
                }
                expect(fake.adapter.duplicateRank).toHaveBeenCalledWith(winner)
            },
        )

        test('places the surviving entry at the first occurrence position', () => {
            const first = account('local', 'FIRST')
            const watch = account('watch', 'DUPE', { id: 'watch' })
            const last = account('local', 'LAST')
            const hardware = account('hardware', 'DUPE', { id: 'hardware' })

            useAccountsStore
                .getState()
                .setAccounts([first, watch, last, hardware])

            expect(useAccountsStore.getState().accounts).toEqual([
                first,
                hardware,
                last,
            ])
        })

        test('keeps the first occurrence when both entries rank equally', () => {
            const a1 = account('local', 'DUPE', { id: '1' })
            const a2 = account('local', 'DUPE', { id: '2' })

            useAccountsStore.getState().setAccounts([a1, a2])

            expect(useAccountsStore.getState().accounts.map(a => a.id)).toEqual(
                ['1'],
            )
        })

        test('returns a duplicate-free list unchanged and in order', () => {
            const accounts = [
                account('watch', 'A'),
                account('local', 'B'),
                account('explicit', 'C'),
            ]

            useAccountsStore.getState().setAccounts(accounts)

            expect(useAccountsStore.getState().accounts).toEqual(accounts)
        })

        test('collapses accounts sharing an address on a second chain, the higher rank in the first position', async () => {
            const { accountsChainAdapters } =
                await import('../../chain-adapter')
            accountsChainAdapters.register({
                ...fake.adapter,
                chainId: 'ethereum',
            })
            const watch = on('watch', 'watch', {
                algorand: { address: 'WATCH' },
                ethereum: { address: '0xDUPE' },
            })
            const other = on('watch', 'other', {
                algorand: { address: 'OTHER' },
            })
            const hd = on('hd', 'hd', {
                algorand: { address: 'HD', keyPairId: 'kp-hd' },
                ethereum: { address: '0xDUPE', keyPairId: 'kp-hd-eth' },
            })

            useAccountsStore.getState().setAccounts([watch, other, hd])

            expect(useAccountsStore.getState().accounts.map(a => a.id)).toEqual(
                ['hd', 'other'],
            )
        })

        test('the same address on two different chains is not a duplicate', () => {
            const onFake = on('watch', 'fake', {
                algorand: { address: 'SAME' },
            })
            const onOther = on('watch', 'other', {
                ethereum: { address: 'SAME' },
            })

            useAccountsStore.getState().setAccounts([onFake, onOther])

            expect(useAccountsStore.getState().accounts.map(a => a.id)).toEqual(
                ['fake', 'other'],
            )
        })
    })

    describe('selection', () => {
        const a1 = account('local', 'A', { id: '1' })
        const a2 = account('local', 'B', { id: '2' })
        const a3 = account('local', 'C', { id: '3' })

        test('getSelectedAccount returns the account the id selects', () => {
            useAccountsStore.getState().setAccounts([a1, a2])
            expect(useAccountsStore.getState().getSelectedAccount()).toEqual(a1)

            useAccountsStore.getState().setSelectedAccountId('2')
            expect(useAccountsStore.getState().getSelectedAccount()).toEqual(a2)

            useAccountsStore.getState().setSelectedAccountId(null)
            expect(useAccountsStore.getState().getSelectedAccount()).toBeNull()
        })

        test('setSelectedAccountId refuses an id that is not an account', () => {
            useAccountsStore.getState().setAccounts([a1, a2])

            useAccountsStore.getState().setSelectedAccountId('ghost')

            expect(useAccountsStore.getState().selectedAccountId).toBe('1')
        })

        test('setAccounts selects the first remaining account when the selected one is removed', () => {
            useAccountsStore.getState().setAccounts([a1, a2])
            useAccountsStore.getState().setSelectedAccountId('1')

            useAccountsStore.getState().setAccounts([a2])

            expect(useAccountsStore.getState().selectedAccountId).toBe('2')
        })

        test('setAccounts resets to null when all accounts are removed', () => {
            useAccountsStore.getState().setAccounts([a1])

            useAccountsStore.getState().setAccounts([])

            expect(useAccountsStore.getState().selectedAccountId).toBeNull()
            expect(useAccountsStore.getState().getSelectedAccount()).toBeNull()
        })

        test('setAccounts auto-selects the first account when nothing is selected', () => {
            expect(useAccountsStore.getState().selectedAccountId).toBeNull()

            useAccountsStore.getState().setAccounts([a1])

            expect(useAccountsStore.getState().selectedAccountId).toBe('1')
        })

        test('setAccounts preserves a selection that still exists', () => {
            useAccountsStore.getState().setAccounts([a1, a2])
            useAccountsStore.getState().setSelectedAccountId('2')

            useAccountsStore.getState().setAccounts([a2, a3])

            expect(useAccountsStore.getState().selectedAccountId).toBe('2')
        })

        test('the manual order keeps known ids and appends new ones', () => {
            useAccountsStore.getState().setAccounts([a1, a2])
            useAccountsStore.getState().setManualAccountOrder(['2', '1'])

            useAccountsStore.getState().setAccounts([a1, a2, a3])
            expect(useAccountsStore.getState().manualAccountOrder).toEqual([
                '2',
                '1',
                '3',
            ])

            useAccountsStore.getState().setAccounts([a3, a1])
            expect(useAccountsStore.getState().manualAccountOrder).toEqual([
                '1',
                '3',
            ])
        })
    })

    test('resetState reverts state to initial values', () => {
        useAccountsStore.getState().setAccounts([account('local', 'A')])

        act(() => {
            useAccountsStore.getState().resetState()
        })

        expect(useAccountsStore.getState().accounts).toEqual([])
        expect(useAccountsStore.getState().selectedAccountId).toBeNull()
    })

    describe('addAccount', () => {
        test('appends an account whose addresses are free', () => {
            const existing = account('watch', 'A')
            const added = account('watch', 'B')
            useAccountsStore.getState().setAccounts([existing])

            useAccountsStore.getState().addAccount(added)

            expect(useAccountsStore.getState().accounts).toEqual([
                existing,
                added,
            ])
        })

        test('throws naming the existing account by id when an address is taken on the same chain', async () => {
            const { DuplicateAccountError } = await import('../../errors')
            const existing = on('watch', 'existing-id', {
                algorand: { address: 'A' },
                ethereum: { address: '0xDUPE' },
            })
            useAccountsStore.getState().setAccounts([existing])

            const add = () =>
                useAccountsStore.getState().addAccount(
                    on('watch', 'added', {
                        ethereum: { address: '0xDUPE' },
                    }),
                )

            expect(add).toThrow(DuplicateAccountError)
            expect(add).toThrow(
                /0xDUPE is already in the wallet as existing-id/,
            )
            expect(useAccountsStore.getState().accounts).toEqual([existing])
        })

        test('accepts an address that an existing account holds only on a different chain', () => {
            useAccountsStore
                .getState()
                .setAccounts([
                    on('watch', 'existing', { algorand: { address: 'SAME' } }),
                ])

            useAccountsStore
                .getState()
                .addAccount(
                    on('watch', 'added', { ethereum: { address: 'SAME' } }),
                )

            expect(useAccountsStore.getState().accounts.map(a => a.id)).toEqual(
                ['existing', 'added'],
            )
        })
    })

    describe('addRekeyedWatchAccounts', () => {
        test('appends watch accounts holding just the address, and records the source as their authority on the scanned network', async () => {
            const added = useAccountsStore
                .getState()
                .addRekeyedWatchAccounts('SRC', ['R1'], TESTNET_SCOPE)

            expect(added).toBe(1)
            const [r1] = useAccountsStore.getState().accounts
            expect(r1.custody).toEqual({ kind: 'watch' })
            expect(r1.chains).toEqual({ algorand: { address: 'R1' } })
            // Imported after resetModules, so it reads this graph's slice.
            const { authorityOf } = await import('../../credentials/accessors')
            expect(authorityOf(r1, TESTNET_SCOPE)).toBe('SRC')
            expect(authorityOf(r1, MAINNET_SCOPE)).toBeNull()
            expect(useAccountsStore.getState().authorities).toEqual({
                [toScopeKey(TESTNET_SCOPE)]: { R1: 'SRC' },
            })
        })

        test('skips addresses already held', () => {
            useAccountsStore.getState().setAccounts([account('local', 'R1')])

            expect(
                useAccountsStore
                    .getState()
                    .addRekeyedWatchAccounts(
                        'SRC',
                        ['R1', 'R2'],
                        TESTNET_SCOPE,
                    ),
            ).toBe(1)
            expect(useAccountsStore.getState().accounts).toHaveLength(2)
        })
    })

    describe('upgradeWatchAccountToHardware', () => {
        test('replaces a watch account with a hardware account, preserving id, name and chains', () => {
            useAccountsStore.getState().setAccounts([
                account('watch', 'WATCHED', {
                    id: 'w1',
                    name: 'My Ledger (watched)',
                }),
            ])

            const upgraded = useAccountsStore
                .getState()
                .upgradeWatchAccountToHardware('w1', {
                    ...hardwareDetails,
                    accountIndex: 3,
                })

            expect(upgraded).toBe(true)
            expect(useAccountsStore.getState().accounts[0]).toStrictEqual({
                id: 'w1',
                name: 'My Ledger (watched)',
                custody: {
                    kind: 'hardware',
                    device: TEST_CUSTODY.hardware.device,
                    accountIndex: 3,
                },
                chains: { algorand: { address: 'WATCHED' } },
            })
        })

        test('refuses to touch a non-watch account', () => {
            const signer = account('local', 'SIGNER')
            useAccountsStore.getState().setAccounts([signer])

            const upgraded = useAccountsStore
                .getState()
                .upgradeWatchAccountToHardware('SIGNER', hardwareDetails)

            expect(upgraded).toBe(false)
            expect(useAccountsStore.getState().accounts[0]).toEqual(signer)
        })

        test('is a no-op for an unknown id', () => {
            expect(
                useAccountsStore
                    .getState()
                    .upgradeWatchAccountToHardware('MISSING', hardwareDetails),
            ).toBe(false)
            expect(useAccountsStore.getState().accounts).toEqual([])
        })
    })

    describe('updateHardwareDetails', () => {
        test('re-binds the hardware custody when the device id changes', () => {
            useAccountsStore
                .getState()
                .setAccounts([account('hardware', 'HW', { name: 'Ledger 1' })])

            const updated = useAccountsStore
                .getState()
                .updateHardwareDetails('HW', {
                    ...hardwareDetails,
                    deviceId: 'new-device',
                })

            expect(updated).toBe(true)
            const [stored] = useAccountsStore.getState().accounts
            expect(stored.custody).toEqual({
                kind: 'hardware',
                device: {
                    ...TEST_CUSTODY.hardware.device,
                    deviceId: 'new-device',
                },
                accountIndex: 0,
            })
            expect(stored.name).toBe('Ledger 1')
            expect(stored.chains).toEqual({ algorand: { address: 'HW' } })
        })

        test('is a no-op when the details are unchanged', () => {
            useAccountsStore.getState().setAccounts([account('hardware', 'HW')])

            expect(
                useAccountsStore
                    .getState()
                    .updateHardwareDetails('HW', { ...hardwareDetails }),
            ).toBe(false)
        })

        test('refuses to touch a non-hardware account', () => {
            const watch = account('watch', 'WATCHED')
            useAccountsStore.getState().setAccounts([watch])

            expect(
                useAccountsStore
                    .getState()
                    .updateHardwareDetails('WATCHED', hardwareDetails),
            ).toBe(false)
            expect(useAccountsStore.getState().accounts[0]).toEqual(watch)
        })
    })

    describe('launch account preference', () => {
        const alice = account('local', 'ALICE', { id: 'alice' })
        const bob = account('local', 'BOB', { id: 'bob' })

        beforeEach(() => {
            useAccountsStore.getState().setAccounts([alice, bob])
        })

        test('defaults to lastUsed with no pinned account', () => {
            const { launchAccountMode, launchAccountId } =
                useAccountsStore.getState()

            expect(launchAccountMode).toBe('lastUsed')
            expect(launchAccountId).toBeNull()
        })

        test('pins a specific account', () => {
            useAccountsStore
                .getState()
                .setLaunchAccountPreference('specific', 'bob')

            expect(useAccountsStore.getState()).toMatchObject({
                launchAccountMode: 'specific',
                launchAccountId: 'bob',
            })
        })

        test('refuses to pin an id that is not a known account', () => {
            useAccountsStore
                .getState()
                .setLaunchAccountPreference('specific', 'ghost')

            expect(useAccountsStore.getState()).toMatchObject({
                launchAccountMode: 'lastUsed',
                launchAccountId: null,
            })
        })

        test('refuses to pin specific mode with no id at all', () => {
            useAccountsStore.getState().setLaunchAccountPreference('specific')

            expect(useAccountsStore.getState().launchAccountMode).toBe(
                'lastUsed',
            )
        })

        test('switching back to lastUsed clears the pinned account', () => {
            useAccountsStore
                .getState()
                .setLaunchAccountPreference('specific', 'bob')

            useAccountsStore.getState().setLaunchAccountPreference('lastUsed')

            expect(useAccountsStore.getState()).toMatchObject({
                launchAccountMode: 'lastUsed',
                launchAccountId: null,
            })
        })

        test('reverts to lastUsed when the pinned account is removed', () => {
            useAccountsStore
                .getState()
                .setLaunchAccountPreference('specific', 'bob')

            useAccountsStore.getState().setAccounts([alice])

            expect(useAccountsStore.getState()).toMatchObject({
                launchAccountMode: 'lastUsed',
                launchAccountId: null,
            })
        })

        test('keeps the pin when an unrelated account is removed', () => {
            useAccountsStore
                .getState()
                .setLaunchAccountPreference('specific', 'bob')

            useAccountsStore.getState().setAccounts([bob])

            expect(useAccountsStore.getState()).toMatchObject({
                launchAccountMode: 'specific',
                launchAccountId: 'bob',
            })
        })

        test('applyLaunchAccountPreference selects the pinned account', () => {
            useAccountsStore.getState().setSelectedAccountId('alice')
            useAccountsStore
                .getState()
                .setLaunchAccountPreference('specific', 'bob')

            useAccountsStore.getState().applyLaunchAccountPreference()

            expect(useAccountsStore.getState().selectedAccountId).toBe('bob')
        })

        test('applyLaunchAccountPreference leaves a lastUsed selection alone', () => {
            useAccountsStore.getState().setSelectedAccountId('bob')

            useAccountsStore.getState().applyLaunchAccountPreference()

            expect(useAccountsStore.getState().selectedAccountId).toBe('bob')
        })

        test('applyLaunchAccountPreference ignores a pin that no longer resolves', () => {
            useAccountsStore.setState({
                launchAccountMode: 'specific',
                launchAccountId: 'ghost',
                selectedAccountId: 'alice',
            })

            useAccountsStore.getState().applyLaunchAccountPreference()

            expect(useAccountsStore.getState().selectedAccountId).toBe('alice')
        })
    })

    describe('v5 migration', () => {
        // Records in the fake chain's legacy shape: a top-level address, a
        // `keyPairId` marking a local key.
        const legacyRecords = () => [
            { id: 'a', name: 'Alpha', address: 'A-ADDR', keyPairId: 'k-a' },
            {
                id: 'h',
                address: 'H-ADDR',
                rekeyAddress: 'AUTH',
                rekeyAddressByNetwork: { mainnet: 'AUTH' },
                custody: TEST_CUSTODY.hardware,
            },
            { id: 'w', address: 'W-ADDR' },
            // Nothing the registered chain decodes.
            { id: 'undecodable', somethingElse: true },
        ]
        const legacyState = () => ({
            accounts: legacyRecords(),
            selectedAccountAddress: 'H-ADDR',
            sortMode: 'alphabeticalAsc',
            manualAccountOrder: ['W-ADDR', 'GONE-ADDR', 'A-ADDR', 'H-ADDR'],
            launchAccountMode: 'specific',
            launchAccountAddress: 'A-ADDR',
        })
        const migratedAccounts: WalletAccount[] = [
            {
                id: 'a',
                name: 'Alpha',
                custody: { kind: 'local', seed: TEST_CUSTODY.local.seed },
                chains: { algorand: { address: 'A-ADDR', keyPairId: 'k-a' } },
            },
            {
                id: 'h',
                custody: TEST_CUSTODY.hardware,
                chains: { algorand: { address: 'H-ADDR' } },
            },
            {
                id: 'w',
                custody: { kind: 'watch' },
                chains: { algorand: { address: 'W-ADDR' } },
            },
        ]
        const migratedState = {
            accounts: migratedAccounts,
            selectedAccountId: 'h',
            sortMode: 'alphabeticalAsc',
            manualAccountOrder: ['w', 'a', 'h'],
            launchAccountMode: 'specific',
            launchAccountId: 'a',
            authorities: {
                [toScopeKey(MAINNET_SCOPE)]: { 'H-ADDR': 'AUTH' },
            },
            unscopedAuthorities: {},
        }

        test.each([2, 3, 4])(
            'decodes every v%s record through the registered chain, keyed by id',
            async version => {
                const { migrateAccountsState } = await import('../store')
                const records = legacyRecords()

                const migrated = migrateAccountsState(
                    { ...legacyState(), accounts: records },
                    version,
                )

                expect(migrated).toStrictEqual(migratedState)
                for (const record of records.filter(r => 'id' in r)) {
                    const {
                        rekeyAddress: _scalar,
                        rekeyAddressByNetwork: _map,
                        ...decoded
                    } = record as Record<string, unknown>
                    expect(
                        fake.adapter.decodeLegacyRecord,
                    ).toHaveBeenCalledWith(decoded)
                }
            },
        )

        test('moves the record authority fields into the authority maps', async () => {
            const { migrateAccountsState } = await import('../store')

            const migrated = migrateAccountsState(
                {
                    ...legacyState(),
                    accounts: [
                        {
                            id: 'm',
                            address: 'M-ADDR',
                            rekeyAddressByNetwork: { testnet: 'T' },
                        },
                        { id: 's', address: 'S-ADDR', rekeyAddress: 'S' },
                    ],
                },
                3,
            )

            for (const migratedAccount of migrated.accounts) {
                expect(migratedAccount).not.toHaveProperty('rekeyAddress')
                expect(migratedAccount).not.toHaveProperty(
                    'rekeyAddressByNetwork',
                )
            }
            expect(migrated.authorities).toEqual({
                [toScopeKey(TESTNET_SCOPE)]: { 'M-ADDR': 'T' },
            })
            expect(migrated.unscopedAuthorities).toEqual({ 'S-ADDR': 'S' })
        })

        test('keeps the authority maps a v4 payload persisted, its entries winning over the record fields', async () => {
            const { migrateAccountsState } = await import('../store')
            const held = {
                [toScopeKey(MAINNET_SCOPE)]: {
                    'H-ADDR': 'HELD',
                    'W-ADDR': 'W',
                },
            }

            const migrated = migrateAccountsState(
                {
                    ...legacyState(),
                    authorities: held,
                    unscopedAuthorities: { 'A-ADDR': 'U' },
                },
                4,
            )

            expect(migrated.authorities).toEqual(held)
            expect(migrated.unscopedAuthorities).toEqual({ 'A-ADDR': 'U' })
        })

        test('keeps a record no adapter decodes when it already holds only custody and chain entries', async () => {
            const { migrateAccountsState } = await import('../store')
            const current = {
                id: 'e',
                custody: { kind: 'local', seed: null },
                chains: { ethereum: { address: '0xabc', keyPairId: 'raw' } },
            }

            const { accounts } = migrateAccountsState(
                { ...legacyState(), accounts: [current] },
                4,
            )

            expect(accounts).toStrictEqual([current])
        })

        test('leaves no legacy key on the migrated accounts or state', async () => {
            const { migrateAccountsState } = await import('../store')

            const migrated = migrateAccountsState(legacyState(), 3)

            for (const key of [
                'selectedAccountAddress',
                'launchAccountAddress',
            ]) {
                expect(migrated).not.toHaveProperty(key)
            }
            for (const migratedAccount of migrated.accounts) {
                for (const key of [
                    'address',
                    'keyPairId',
                    'type',
                    'hardwareDetails',
                    'hdWalletDetails',
                    'multisigDetails',
                ]) {
                    expect(migratedAccount).not.toHaveProperty(key)
                }
            }
        })

        test('decodes v0 and v1 records from their legacy fields, ignoring a stored custody', async () => {
            const { migrateAccountsState } = await import('../store')
            const v1Records = legacyRecords().map(record => ({
                ...record,
                custody: { kind: 'watch' },
                chains: { algorand: { address: 'STALE' } },
                provenance: { kind: 'stale' },
            }))

            for (const version of [0, 1]) {
                const { accounts } = migrateAccountsState(
                    { ...legacyState(), accounts: structuredClone(v1Records) },
                    version,
                )

                // The hardware custody record `h` stored is dropped: it
                // decodes as the address-only record it is underneath.
                expect(accounts.map(a => a.custody.kind)).toEqual([
                    'local',
                    'watch',
                    'watch',
                ])
                expect(accounts[1].chains).toEqual({
                    algorand: { address: 'H-ADDR' },
                })
            }
        })

        test.each([2, 3, 4])(
            'gives a v%s record persisted without an id one derived from its address, and keeps what pointed at it',
            async version => {
                const { migrateAccountsState } = await import('../store')

                const migrated = migrateAccountsState(
                    {
                        ...legacyState(),
                        accounts: [
                            ...legacyRecords(),
                            { address: 'NO-ID', keyPairId: 'k-n' },
                            { id: '', address: 'EMPTY-ID' },
                        ],
                        selectedAccountAddress: 'NO-ID',
                        manualAccountOrder: ['NO-ID', 'A-ADDR', 'EMPTY-ID'],
                        launchAccountAddress: 'EMPTY-ID',
                    },
                    version,
                )

                const noId = migrated.accounts.find(
                    a => a.chains.algorand?.address === 'NO-ID',
                )
                const emptyId = migrated.accounts.find(
                    a => a.chains.algorand?.address === 'EMPTY-ID',
                )
                expect(noId).toMatchObject({
                    custody: { kind: 'local' },
                    chains: { algorand: { keyPairId: 'k-n' } },
                })
                expect(noId?.id).toBe('legacy:algorand:NO-ID')
                expect(emptyId?.id).toBe('legacy:algorand:EMPTY-ID')
                expect(new Set(migrated.accounts.map(a => a.id)).size).toBe(
                    migrated.accounts.length,
                )
                expect(migrated.accounts.map(a => a.id)).not.toContain('')
                expect(migrated.selectedAccountId).toBe(noId?.id)
                expect(migrated.manualAccountOrder).toEqual([
                    noId?.id,
                    'a',
                    emptyId?.id,
                ])
                expect(migrated.launchAccountId).toBe(emptyId?.id)
                expect(migrated.launchAccountMode).toBe('specific')
            },
        )

        test('derives the same ids wherever it runs, and distinct ones for a repeated address', async () => {
            const { migrateAccountsState } = await import('../store')
            const payload = () => ({
                ...legacyState(),
                accounts: [
                    { address: 'TWICE', keyPairId: 'k-1' },
                    { address: 'TWICE' },
                    { id: 'legacy:algorand:TAKEN', address: 'OTHER' },
                    { address: 'TAKEN' },
                ],
            })

            const first = migrateAccountsState(payload(), 4)
            const second = migrateAccountsState(payload(), 4)

            expect(first.accounts.map(a => a.id)).toEqual([
                'legacy:algorand:TWICE',
                'legacy:algorand:TWICE:2',
                'legacy:algorand:TAKEN',
                'legacy:algorand:TAKEN:2',
            ])
            expect(second).toStrictEqual(first)
        })

        test('skips a chain adapter that decodes no legacy records', async () => {
            const { accountsChainAdapters } =
                await import('../../chain-adapter')
            accountsChainAdapters.reset()
            accountsChainAdapters.register({
                ...fake.adapter,
                decodeLegacyRecord: undefined,
            })
            const { migrateAccountsState } = await import('../store')
            const current = on('watch', 'current', {
                algorand: { address: 'CURRENT' },
            })

            const migrated = migrateAccountsState(
                {
                    ...legacyState(),
                    accounts: [...legacyRecords(), current],
                },
                4,
            )

            expect(migrated.accounts).toEqual([current])
        })

        test('falls back to lastUsed when the launch pin names no surviving account', async () => {
            const { migrateAccountsState } = await import('../store')

            const migrated = migrateAccountsState(
                { ...legacyState(), launchAccountAddress: 'GONE-ADDR' },
                3,
            )

            expect(migrated.launchAccountMode).toBe('lastUsed')
            expect(migrated.launchAccountId).toBeNull()
        })

        test('persisted v5 state is not migrated again', async () => {
            const { migrateAccountsState } = await import('../store')

            expect(migrateAccountsState(migratedState, 5)).toBe(migratedState)
        })

        test('stays at its defaults, and writes nothing back, until rehydrateAccountsStore runs', async () => {
            const persisted = JSON.stringify({
                state: legacyState(),
                version: 3,
            })
            getProvider().keyValueStorage.setItem(STORE_KEY, persisted)

            const module = await loadStore()

            expect(module.useAccountsStore.persist.hasHydrated()).toBe(false)
            expect(module.useAccountsStore.getState().accounts).toEqual([])
            expect(fake.adapter.decodeLegacyRecord).not.toHaveBeenCalled()
            expect(getProvider().keyValueStorage.getItem(STORE_KEY)).toBe(
                persisted,
            )

            await module.rehydrateAccountsStore()

            expect(module.useAccountsStore.persist.hasHydrated()).toBe(true)
            expect(module.useAccountsStore.getState()).toMatchObject(
                migratedState,
            )
        })

        test('drops a write made before hydration, then persists the migrated state', async () => {
            const persisted = JSON.stringify({
                state: legacyState(),
                version: 3,
            })
            getProvider().keyValueStorage.setItem(STORE_KEY, persisted)
            const module = await loadStore()

            module.useAccountsStore.getState().settleAuthorities({}, {})
            module.useAccountsStore.getState().setAccounts([])

            expect(getProvider().keyValueStorage.getItem(STORE_KEY)).toBe(
                persisted,
            )

            await module.rehydrateAccountsStore()

            const written = JSON.parse(
                getProvider().keyValueStorage.getItem(STORE_KEY) as string,
            )
            expect(written).toMatchObject({ version: 5, state: migratedState })

            const added = account('watch', 'NEW-ADDR')
            module.useAccountsStore
                .getState()
                .setAccounts([...migratedAccounts, added])

            expect(
                JSON.parse(
                    getProvider().keyValueStorage.getItem(STORE_KEY) as string,
                ).state.accounts,
            ).toContainEqual(added)
        })

        test('leaves storage untouched, and keeps dropping writes, when the migration throws', async () => {
            const persisted = JSON.stringify({
                state: legacyState(),
                version: 3,
            })
            getProvider().keyValueStorage.setItem(STORE_KEY, persisted)
            const module = await loadStore()
            vi.mocked(fake.adapter.decodeLegacyRecord!).mockImplementation(
                () => {
                    throw new Error('decoder broke')
                },
            )

            await module.rehydrateAccountsStore()
            module.useAccountsStore
                .getState()
                .setAccounts([account('watch', 'NEW-ADDR')])

            expect(module.useAccountsStore.persist.hasHydrated()).toBe(false)
            expect(getProvider().keyValueStorage.getItem(STORE_KEY)).toBe(
                persisted,
            )
        })

        test('hydrating a legacy payload twice yields identical state', async () => {
            getProvider().keyValueStorage.setItem(
                STORE_KEY,
                JSON.stringify({ state: legacyState(), version: 0 }),
            )

            const first = await loadStore()
            await first.rehydrateAccountsStore()
            const firstState = first.useAccountsStore.getState()

            const second = await loadStore()
            await second.rehydrateAccountsStore()

            expect(second.useAccountsStore.getState().accounts).toEqual(
                firstState.accounts,
            )
            expect(second.useAccountsStore.getState().selectedAccountId).toBe(
                firstState.selectedAccountId,
            )
        })
    })
})
