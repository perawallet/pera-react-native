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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    chainAccountOf,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { LegacyAccount } from '@perawallet/wallet-extension-platform'
import {
    addKeylessAccountToStore,
    applyAllLegacyMetadata,
    applyLegacyAccountOrder,
    markLegacyBackedUpAccounts,
    removeAccountFromStore,
} from '../accountStoreOps'
import type { MigratedAccountPair } from '../types'

vi.mock(import('@perawallet/wallet-core-accounts'), async importOriginal => {
    return await importOriginal()
})

type AccountInput = Partial<Omit<WalletAccount, 'chains'>> & {
    address?: string
}

// The id is derived from the address so order and removal assertions can name it.
const idFor = (address: string) => `id-${address}`

const buildWalletAccount = ({
    address = 'ADDR_A',
    ...overrides
}: AccountInput = {}): WalletAccount => {
    const custody = overrides.custody ?? {
        kind: 'local' as const,
        seed: null,
    }
    return {
        id: idFor(address),
        name: 'Account A',
        ...overrides,
        custody,
        chains: {
            algorand:
                custody.kind === 'local'
                    ? { address, keyPairId: `kp-${address}` }
                    : { address },
        },
    }
}

const addressOf = (account: WalletAccount) =>
    chainAccountOf(account, 'algorand')?.address

const buildLegacyAccount = (
    overrides: Partial<LegacyAccount> = {},
): LegacyAccount =>
    ({
        address: 'ADDR_A',
        name: 'Legacy A',
        type: 'standard',
        preferredOrder: 0,
        isBackedUp: true,
        secretKey: null,
        hdSeedId: null,
        authAddress: null,
        ...overrides,
    }) as LegacyAccount

const buildPair = (
    created: AccountInput,
    legacy: Partial<LegacyAccount>,
): MigratedAccountPair => ({
    created: buildWalletAccount({ ...created }),
    legacy: buildLegacyAccount({ address: created.address, ...legacy }),
})

beforeEach(() => {
    useAccountsStore.getState().resetState()
})

describe('addKeylessAccountToStore', () => {
    it('appends the account to an empty store and returns it', () => {
        const account = buildWalletAccount({ address: 'ADDR_NEW' })

        const returned = addKeylessAccountToStore(account)

        expect(returned).toBe(account)
        expect(useAccountsStore.getState().accounts).toEqual([account])
    })

    it('appends to existing accounts without dropping them', () => {
        const existing = buildWalletAccount({ address: 'ADDR_EXISTING' })
        useAccountsStore.getState().setAccounts([existing])
        const incoming = buildWalletAccount({ address: 'ADDR_INCOMING' })

        addKeylessAccountToStore(incoming)

        expect(useAccountsStore.getState().accounts.map(addressOf)).toEqual([
            'ADDR_EXISTING',
            'ADDR_INCOMING',
        ])
    })
})

describe('applyAllLegacyMetadata', () => {
    it('returns early without touching the store when pairs is empty', () => {
        const existing = buildWalletAccount({ address: 'ADDR_X' })
        useAccountsStore.getState().setAccounts([existing])
        const setAccountsSpy = vi.spyOn(
            useAccountsStore.getState(),
            'setAccounts',
        )

        applyAllLegacyMetadata([], 'algorand')

        expect(setAccountsSpy).not.toHaveBeenCalled()
    })

    it('renames an account when the legacy name differs', () => {
        const account = buildWalletAccount({
            address: 'ADDR_A',
            name: 'Created Name',
        })
        useAccountsStore.getState().setAccounts([account])

        applyAllLegacyMetadata(
            [
                buildPair(
                    { address: 'ADDR_A', name: 'Created Name' },
                    { name: 'Legacy Name' },
                ),
            ],
            'algorand',
        )

        expect(useAccountsStore.getState().accounts[0].name).toBe('Legacy Name')
    })

    it('keeps the existing name when the legacy name is empty', () => {
        const account = buildWalletAccount({
            address: 'ADDR_A',
            name: 'Created Name',
        })
        useAccountsStore.getState().setAccounts([account])

        applyAllLegacyMetadata(
            [
                buildPair(
                    { address: 'ADDR_A', name: 'Created Name' },
                    { name: '' },
                ),
            ],
            'algorand',
        )

        expect(useAccountsStore.getState().accounts[0].name).toBe(
            'Created Name',
        )
    })

    it('leaves accounts not referenced by pairs untouched', () => {
        const matched = buildWalletAccount({
            address: 'ADDR_A',
            name: 'A old',
        })
        const untouched = buildWalletAccount({
            address: 'ADDR_B',
            name: 'B old',
        })
        useAccountsStore.getState().setAccounts([matched, untouched])

        applyAllLegacyMetadata(
            [
                buildPair(
                    { address: 'ADDR_A', name: 'A old' },
                    { name: 'A new' },
                ),
            ],
            'algorand',
        )

        const accounts = useAccountsStore.getState().accounts
        expect(accounts.find(a => addressOf(a) === 'ADDR_A')?.name).toBe(
            'A new',
        )
        expect(accounts.find(a => addressOf(a) === 'ADDR_B')?.name).toBe(
            'B old',
        )
    })

    it('preserves the accounts array reference when no names actually change', () => {
        const account = buildWalletAccount({
            address: 'ADDR_A',
            name: 'Same Name',
        })
        useAccountsStore.getState().setAccounts([account])
        const accountsBefore = useAccountsStore.getState().accounts

        applyAllLegacyMetadata(
            [
                buildPair(
                    { address: 'ADDR_A', name: 'Same Name' },
                    { name: 'Same Name' },
                ),
            ],
            'algorand',
        )

        expect(useAccountsStore.getState().accounts).toBe(accountsBefore)
    })
})

describe('markLegacyBackedUpAccounts', () => {
    it('marks only the accounts the user had backed up in the legacy app', () => {
        const markAccountBackedUp = vi.fn()

        markLegacyBackedUpAccounts(
            [
                buildPair({ address: 'ADDR_A' }, { isBackedUp: true }),
                buildPair({ address: 'ADDR_B' }, { isBackedUp: false }),
            ],
            markAccountBackedUp,
        )

        expect(markAccountBackedUp).toHaveBeenCalledTimes(1)
        expect(markAccountBackedUp).toHaveBeenCalledWith(
            expect.objectContaining({ id: idFor('ADDR_A') }),
        )
    })

    it('forwards the created account to the marker, which owns key routing', () => {
        const markAccountBackedUp = vi.fn()

        markLegacyBackedUpAccounts(
            [
                buildPair(
                    { address: 'ADDR_W', custody: { kind: 'watch' } },
                    { isBackedUp: true },
                ),
            ],
            markAccountBackedUp,
        )

        expect(markAccountBackedUp).toHaveBeenCalledWith(
            expect.objectContaining({ id: idFor('ADDR_W') }),
        )
    })

    it('no-ops when no marker is injected', () => {
        expect(() =>
            markLegacyBackedUpAccounts([
                buildPair({ address: 'ADDR_A' }, { isBackedUp: true }),
            ]),
        ).not.toThrow()
    })
})

describe('applyLegacyAccountOrder', () => {
    it('returns early when no legacy account has a non-negative preferredOrder', () => {
        const account = buildWalletAccount({ address: 'ADDR_A' })
        useAccountsStore.getState().setAccounts([account])
        const setOrderSpy = vi.spyOn(
            useAccountsStore.getState(),
            'setManualAccountOrder',
        )

        applyLegacyAccountOrder(
            [buildLegacyAccount({ address: 'ADDR_A', preferredOrder: -1 })],
            'algorand',
        )

        expect(setOrderSpy).not.toHaveBeenCalled()
    })

    it('orders accounts by ascending preferredOrder', () => {
        useAccountsStore
            .getState()
            .setAccounts([
                buildWalletAccount({ address: 'ADDR_A' }),
                buildWalletAccount({ address: 'ADDR_B' }),
                buildWalletAccount({ address: 'ADDR_C' }),
            ])

        applyLegacyAccountOrder(
            [
                buildLegacyAccount({ address: 'ADDR_A', preferredOrder: 2 }),
                buildLegacyAccount({ address: 'ADDR_B', preferredOrder: 0 }),
                buildLegacyAccount({ address: 'ADDR_C', preferredOrder: 1 }),
            ],
            'algorand',
        )

        expect(useAccountsStore.getState().manualAccountOrder).toEqual([
            idFor('ADDR_B'),
            idFor('ADDR_C'),
            idFor('ADDR_A'),
        ])
    })

    it('places accounts without a matching legacy entry after ordered ones', () => {
        useAccountsStore
            .getState()
            .setAccounts([
                buildWalletAccount({ address: 'ADDR_A' }),
                buildWalletAccount({ address: 'ADDR_UNORDERED' }),
                buildWalletAccount({ address: 'ADDR_B' }),
            ])

        applyLegacyAccountOrder(
            [
                buildLegacyAccount({ address: 'ADDR_B', preferredOrder: 0 }),
                buildLegacyAccount({ address: 'ADDR_A', preferredOrder: 1 }),
            ],
            'algorand',
        )

        const order = useAccountsStore.getState().manualAccountOrder
        expect(order.slice(0, 2)).toEqual([idFor('ADDR_B'), idFor('ADDR_A')])
        expect(order.indexOf(idFor('ADDR_UNORDERED'))).toBe(2)
    })

    it('skips legacy entries with negative preferredOrder and orders the rest', () => {
        useAccountsStore
            .getState()
            .setAccounts([
                buildWalletAccount({ address: 'ADDR_A' }),
                buildWalletAccount({ address: 'ADDR_B' }),
            ])

        applyLegacyAccountOrder(
            [
                buildLegacyAccount({ address: 'ADDR_A', preferredOrder: -1 }),
                buildLegacyAccount({ address: 'ADDR_B', preferredOrder: 0 }),
            ],
            'algorand',
        )

        const order = useAccountsStore.getState().manualAccountOrder
        expect(order[0]).toBe(idFor('ADDR_B'))
        expect(order).toContain(idFor('ADDR_A'))
    })
})

describe('removeAccountFromStore', () => {
    it('removes exactly the requested account', () => {
        useAccountsStore.getState().setAccounts([
            buildWalletAccount({
                custody: { kind: 'watch' },
                address: 'ADDR_A',
            }),
            buildWalletAccount({
                custody: { kind: 'watch' },
                address: 'ADDR_B',
            }),
        ])

        removeAccountFromStore(idFor('ADDR_A'))

        expect(useAccountsStore.getState().accounts.map(addressOf)).toEqual([
            'ADDR_B',
        ])
    })
})
