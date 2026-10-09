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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import React from 'react'
import { testAccount } from '../../__tests__/accountFactory'
import {
    fakeAccountsChain,
    MAINNET_SCOPE,
    TESTNET_SCOPE,
} from '../../__tests__/fakeAccountsChain'
import { useAccountStateQuery } from '../useAccountStateQuery'

const mockGetAccountBalance = vi.hoisted(() => vi.fn())

vi.mock('../../db', () => ({
    getAccountBalance: mockGetAccountBalance,
}))

const storedBalance = {
    accountAddress: 'ADDR',
    algoBalance: new Decimal('1.5'),
    minBalance: new Decimal('0.1'),
    status: 'Online',
    totalAssetsOptedIn: 1,
    totalCreatedAssets: 0,
    totalAppsOptedIn: 0,
    authAddress: 'AUTH',
}

describe('useAccountStateQuery', () => {
    let wrapper: React.FC<{ children: React.ReactNode }>

    beforeEach(() => {
        mockGetAccountBalance.mockReset()
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        wrapper = ({ children }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )
    })

    test('reads the stored balance row on the scope and asks the chain for its state and summary', async () => {
        mockGetAccountBalance.mockResolvedValue(storedBalance)
        const account = testAccount('local', 'ADDR')

        const { result } = renderHook(
            () => useAccountStateQuery(account, TESTNET_SCOPE),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        const { toChainState, summarizeChainState } =
            fakeAccountsChain().adapter
        expect(mockGetAccountBalance).toHaveBeenCalledWith({
            accountAddress: 'ADDR',
            scope: TESTNET_SCOPE,
        })
        expect(toChainState).toHaveBeenCalledWith(storedBalance)
        expect(summarizeChainState).toHaveBeenCalledWith(
            vi.mocked(toChainState).mock.results[0].value,
        )
        expect(result.current.data).toEqual({
            address: 'ADDR',
            scope: TESTNET_SCOPE,
            nativeBalance: new Decimal('1.5'),
            reserveBalance: new Decimal('0.1'),
            heldTokenCount: 0,
            chainState: vi.mocked(toChainState).mock.results[0].value,
        })
    })

    test('an account never synced reads as empty, with no authority', async () => {
        mockGetAccountBalance.mockResolvedValue(undefined)

        const { result } = renderHook(
            () =>
                useAccountStateQuery(
                    testAccount('watch', 'ADDR'),
                    MAINNET_SCOPE,
                ),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data?.nativeBalance).toEqual(new Decimal(0))
        expect(result.current.data?.reserveBalance).toEqual(new Decimal(0))
        expect(fakeAccountsChain().adapter.toChainState).toHaveBeenCalledWith({
            authorityAddress: null,
        })
    })

    test('is disabled for an account with no address on the scope', () => {
        const elsewhere = { chainId: 'ethereum', networkId: 'mainnet' } as const

        const { result } = renderHook(
            () => useAccountStateQuery(testAccount('local', 'ADDR'), elsewhere),
            { wrapper },
        )

        expect(result.current.isPending).toBe(true)
        expect(mockGetAccountBalance).not.toHaveBeenCalled()
    })

    test.each([null, undefined])('is disabled for no account (%s)', account => {
        const { result } = renderHook(
            () => useAccountStateQuery(account, MAINNET_SCOPE),
            { wrapper },
        )

        expect(result.current.isPending).toBe(true)
        expect(mockGetAccountBalance).not.toHaveBeenCalled()
    })

    test('keys the cache per address', async () => {
        mockGetAccountBalance.mockResolvedValue(storedBalance)

        const first = renderHook(
            () =>
                useAccountStateQuery(
                    testAccount('local', 'ONE'),
                    MAINNET_SCOPE,
                ),
            { wrapper },
        )
        await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
        const second = renderHook(
            () =>
                useAccountStateQuery(
                    testAccount('local', 'TWO'),
                    MAINNET_SCOPE,
                ),
            { wrapper },
        )
        await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

        expect(first.result.current.data?.address).toBe('ONE')
        expect(second.result.current.data?.address).toBe('TWO')
        expect(mockGetAccountBalance).toHaveBeenCalledTimes(2)
    })
})
