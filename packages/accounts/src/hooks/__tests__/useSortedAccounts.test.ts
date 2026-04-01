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
import { renderHook, act } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useSortedAccounts } from '../useSortedAccounts'
import { useAccountsStore } from '../../store'
import type {
    WalletAccount,
    AccountBalances,
    AccountBalance,
} from '../../models'

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

const makeAccount = (address: string, name?: string): WalletAccount =>
    ({
        id: address,
        address,
        type: 'algo25',
        name,
        keyPairId: address,
    }) as WalletAccount

const makeBalance = (algoValue: number): AccountBalance => ({
    assetBalances: [],
    algoValue: Decimal(algoValue),
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
            useSortedAccounts(accounts, balances),
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
            useSortedAccounts(accounts, balances),
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
            useSortedAccounts(accounts, balances),
        )

        expect(result.current.sortedAccounts.map(a => a.address)).toEqual([
            'ADDR_B',
            'ADDR_A',
            'ADDR_C',
        ])
    })

    test('sorts by balance descending', () => {
        useAccountsStore.setState({ sortMode: 'balanceDesc' })
        const { result } = renderHook(() =>
            useSortedAccounts(accounts, balances),
        )

        expect(result.current.sortedAccounts.map(a => a.address)).toEqual([
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
            useSortedAccounts(accounts, balances),
        )

        expect(result.current.sortedAccounts.map(a => a.address)).toEqual([
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
            useSortedAccounts(accounts, balances),
        )

        expect(result.current.sortedAccounts[0].address).toBe('ADDR_A')
        expect(result.current.sortedAccounts).toHaveLength(3)
    })

    test('handles empty accounts', () => {
        const { result } = renderHook(() => useSortedAccounts([], new Map()))

        expect(result.current.sortedAccounts).toEqual([])
    })

    test('handles accounts without balance data in balance sort', () => {
        useAccountsStore.setState({ sortMode: 'balanceAsc' })
        const partialBalances: AccountBalances = new Map([
            ['ADDR_A', makeBalance(100)],
        ])
        const { result } = renderHook(() =>
            useSortedAccounts(accounts, partialBalances),
        )

        // Accounts without balance data (-1) should come first in ascending
        expect(result.current.sortedAccounts[2].address).toBe('ADDR_A')
    })

    test('exposes setSortMode and setManualAccountOrder', () => {
        const { result } = renderHook(() =>
            useSortedAccounts(accounts, balances),
        )

        act(() => {
            result.current.setSortMode('alphabeticalAsc')
        })

        expect(result.current.sortMode).toBe('alphabeticalAsc')
    })
})
