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
import { renderHook, act } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import {
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
    type ChainDescriptor,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useSortedAccounts } from '../useSortedAccounts'
import { useAccountsStore } from '../../store'
import type {
    WalletAccount,
    AccountBalances,
    AccountBalance,
} from '../../models'
import { testAccount } from '../../__tests__/accountFactory'
import { FAKE_CHAIN_ID } from '../../__tests__/fakeAccountsChain'

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

// Ids equal addresses so one string names an account in every assertion.
const makeAccount = (address: string, name?: string): WalletAccount =>
    testAccount('local', address, {
        id: address,
        ...(name === undefined ? {} : { name }),
    })

const makeBalance = (nativeValue: number): AccountBalance => ({
    assetBalances: [],
    nativeValue: new Decimal(nativeValue),
    usdValue: new Decimal(nativeValue),
    fiatValue: new Decimal(nativeValue),
    isPending: false,
    isFetched: true,
    isRefetching: false,
    isError: false,
})

describe('useSortedAccounts', () => {
    const accountA = makeAccount('ADDR_A', 'Alice')
    const accountB = makeAccount('ADDR_B', 'Bob')
    const accountC = makeAccount('ADDR_C', 'Charlie')
    const accounts = [accountB, accountC, accountA]

    const balances: AccountBalances = new Map([
        ['ADDR_A', makeBalance(100)],
        ['ADDR_B', makeBalance(50)],
        ['ADDR_C', makeBalance(200)],
    ])

    beforeEach(() => {
        useAccountsStore.setState({
            accounts,
            sortMode: 'manual',
            manualAccountOrder: ['ADDR_B', 'ADDR_C', 'ADDR_A'],
        })
    })

    test('sorts alphabetically A to Z', () => {
        useAccountsStore.setState({ sortMode: 'alphabeticalAsc' })
        const { result } = renderHook(() =>
            useSortedAccounts(accounts, balances, FAKE_CHAIN_ID),
        )

        expect(result.current.sortedAccounts.map(a => a.name)).toEqual([
            'Alice',
            'Bob',
            'Charlie',
        ])
    })

    test('sorts alphabetically Z to A', () => {
        useAccountsStore.setState({ sortMode: 'alphabeticalDesc' })
        const { result } = renderHook(() =>
            useSortedAccounts(accounts, balances, FAKE_CHAIN_ID),
        )

        expect(result.current.sortedAccounts.map(a => a.name)).toEqual([
            'Charlie',
            'Bob',
            'Alice',
        ])
    })

    test('sorts by balance ascending', () => {
        useAccountsStore.setState({ sortMode: 'balanceAsc' })
        const { result } = renderHook(() =>
            useSortedAccounts(accounts, balances, FAKE_CHAIN_ID),
        )

        expect(result.current.sortedAccounts.map(a => a.id)).toEqual([
            'ADDR_B',
            'ADDR_A',
            'ADDR_C',
        ])
    })

    test('sorts by balance descending', () => {
        useAccountsStore.setState({ sortMode: 'balanceDesc' })
        const { result } = renderHook(() =>
            useSortedAccounts(accounts, balances, FAKE_CHAIN_ID),
        )

        expect(result.current.sortedAccounts.map(a => a.id)).toEqual([
            'ADDR_C',
            'ADDR_A',
            'ADDR_B',
        ])
    })

    test('sorts by nativeValue even when fiatValue is unknown', () => {
        useAccountsStore.setState({ sortMode: 'balanceDesc' })
        const withNullFiat = new Map([
            ['ADDR_A', { nativeValue: new Decimal(100), fiatValue: null }],
            ['ADDR_B', { nativeValue: new Decimal(50), fiatValue: null }],
            ['ADDR_C', { nativeValue: new Decimal(200), fiatValue: null }],
        ])
        const { result } = renderHook(() =>
            useSortedAccounts(accounts, withNullFiat, FAKE_CHAIN_ID),
        )

        expect(result.current.sortedAccounts.map(a => a.id)).toEqual([
            'ADDR_C',
            'ADDR_A',
            'ADDR_B',
        ])
    })

    test('sorts manually by manualAccountOrder', () => {
        useAccountsStore.setState({
            sortMode: 'manual',
            manualAccountOrder: ['ADDR_C', 'ADDR_A', 'ADDR_B'],
        })
        const { result } = renderHook(() =>
            useSortedAccounts(accounts, balances, FAKE_CHAIN_ID),
        )

        expect(result.current.sortedAccounts.map(a => a.id)).toEqual([
            'ADDR_C',
            'ADDR_A',
            'ADDR_B',
        ])
    })

    test('puts accounts without manual order at end', () => {
        useAccountsStore.setState({
            sortMode: 'manual',
            manualAccountOrder: ['ADDR_A'],
        })
        const { result } = renderHook(() =>
            useSortedAccounts(accounts, balances, FAKE_CHAIN_ID),
        )

        expect(result.current.sortedAccounts[0].id).toBe('ADDR_A')
        expect(result.current.sortedAccounts).toHaveLength(3)
    })

    test('handles empty accounts', () => {
        const { result } = renderHook(() =>
            useSortedAccounts([], new Map(), FAKE_CHAIN_ID),
        )

        expect(result.current.sortedAccounts).toEqual([])
    })

    test('handles accounts without balance data in balance sort', () => {
        useAccountsStore.setState({ sortMode: 'balanceAsc' })
        const partialBalances: AccountBalances = new Map([
            ['ADDR_A', makeBalance(100)],
        ])
        const { result } = renderHook(() =>
            useSortedAccounts(accounts, partialBalances, FAKE_CHAIN_ID),
        )

        // Accounts without balance data (-1) should come first in ascending
        expect(result.current.sortedAccounts[2].id).toBe('ADDR_A')
    })

    test('exposes setSortMode and setManualAccountOrder', () => {
        const { result } = renderHook(() =>
            useSortedAccounts(accounts, balances, FAKE_CHAIN_ID),
        )

        act(() => {
            result.current.setSortMode('alphabeticalAsc')
        })

        expect(result.current.sortMode).toBe('alphabeticalAsc')
    })

    test('names an unnamed account by its address on the chain when sorting alphabetically', () => {
        useAccountsStore.setState({ sortMode: 'alphabeticalAsc' })
        const unnamed = makeAccount('AAA_UNNAMED')

        const { result } = renderHook(() =>
            useSortedAccounts([accountA, unnamed], balances, FAKE_CHAIN_ID),
        )

        expect(result.current.sortedAccounts.map(a => a.id)).toEqual([
            'AAA_UNNAMED',
            'ADDR_A',
        ])
    })

    describe('with a second chain registered', () => {
        const ALL_ON = Object.fromEntries(
            CHAIN_CAPABILITIES.map(capability => [capability, true]),
        ) as ChainCapabilities
        const ethereumAccount: WalletAccount = {
            id: '0xETH',
            name: 'Eve',
            custody: { kind: 'watch' },
            chains: { ethereum: { address: '0xETH' } },
        }
        // ALGO price unloaded: the native amount still ranks, fiat is unknown.
        const asaOnly = makeAccount('ADDR_ASA', 'Asa')
        const values = new Map([
            [
                'ADDR_A',
                { nativeValue: new Decimal(1000), fiatValue: new Decimal(100) },
            ],
            ['ADDR_ASA', { nativeValue: new Decimal(5000), fiatValue: null }],
            [
                '0xETH',
                { nativeValue: new Decimal(1), fiatValue: new Decimal(3000) },
            ],
        ])

        beforeEach(() => {
            for (const id of ['algorand', 'ethereum']) {
                getProvider().chains.register(
                    { id, networks: [] } as unknown as ChainDescriptor,
                    ALL_ON,
                )
            }
        })

        test('keeps ranking Algorand-only accounts by native value', () => {
            useAccountsStore.setState({ sortMode: 'balanceDesc' })
            const { result } = renderHook(() =>
                useSortedAccounts([accountA, asaOnly], values, FAKE_CHAIN_ID),
            )

            expect(result.current.sortedAccounts.map(a => a.id)).toEqual([
                'ADDR_ASA',
                'ADDR_A',
            ])
        })

        test('ranks by fiat once an Ethereum account is listed', () => {
            useAccountsStore.setState({ sortMode: 'balanceDesc' })
            const { result } = renderHook(() =>
                useSortedAccounts(
                    [accountA, ethereumAccount],
                    values,
                    FAKE_CHAIN_ID,
                ),
            )

            expect(result.current.sortedAccounts.map(a => a.id)).toEqual([
                '0xETH',
                'ADDR_A',
            ])
        })

        test.each(['balanceAsc', 'balanceDesc'] as const)(
            'sorts an unpriced account last in %s',
            sortMode => {
                useAccountsStore.setState({ sortMode })
                const { result } = renderHook(() =>
                    useSortedAccounts(
                        [asaOnly, accountA, ethereumAccount],
                        values,
                        FAKE_CHAIN_ID,
                    ),
                )

                expect(result.current.sortedAccounts.at(-1)?.id).toBe(
                    'ADDR_ASA',
                )
            },
        )
    })
})
