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

// @vitest-environment jsdom
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
    registerFakeNativeAsset,
} from '../../__tests__/fakeAccountsChain'
import { useAccountStateQuery } from '../useAccountStateQuery'

const mockGetAccountChainStateRow = vi.hoisted(() => vi.fn())

vi.mock('../../db', () => ({
    getAccountChainStateRow: mockGetAccountChainStateRow,
}))

const storedChainState = {
    family: 'algorand',
    minBalance: new Decimal(100_000),
    status: 'Online',
    totalAssetsOptedIn: 1,
    totalCreatedAssets: 0,
    totalAppsOptedIn: 0,
    authAddress: 'AUTH',
} as const

const storedRow = {
    accountAddress: 'ADDR',
    nativeBalance: new Decimal(1_500_000),
    chainData: storedChainState,
}

describe('useAccountStateQuery', () => {
    let wrapper: React.FC<{ children: React.ReactNode }>

    beforeEach(() => {
        mockGetAccountChainStateRow.mockReset()
        registerFakeNativeAsset()
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

    test('reads the stored chain-state row on the scope and asks the chain for its summary', async () => {
        mockGetAccountChainStateRow.mockResolvedValue(storedRow)
        const account = testAccount('local', 'ADDR')

        const { result } = renderHook(
            () => useAccountStateQuery(account, TESTNET_SCOPE),
            { wrapper },
        )

        expect(result.current.isPending).toBe(true)
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        const { toChainState, summarizeChainState } =
            fakeAccountsChain().adapter
        expect(mockGetAccountChainStateRow).toHaveBeenCalledWith({
            accountAddress: 'ADDR',
            scope: TESTNET_SCOPE,
        })
        expect(toChainState).not.toHaveBeenCalled()
        expect(summarizeChainState).toHaveBeenCalledWith(storedChainState)
        expect(result.current.data).toEqual({
            address: 'ADDR',
            scope: TESTNET_SCOPE,
            nativeBalance: new Decimal('1.5'),
            ...vi.mocked(summarizeChainState).mock.results[0].value,
            chainState: storedChainState,
        })
    })

    test('an account never synced reads as empty, with no authority', async () => {
        mockGetAccountChainStateRow.mockResolvedValue(undefined)

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

        expect(result.current.isPending).toBe(false)
        expect(mockGetAccountChainStateRow).not.toHaveBeenCalled()
    })

    test.each([null, undefined])('is disabled for no account (%s)', account => {
        const { result } = renderHook(
            () => useAccountStateQuery(account, MAINNET_SCOPE),
            { wrapper },
        )

        expect(result.current.isPending).toBe(false)
        expect(mockGetAccountChainStateRow).not.toHaveBeenCalled()
    })

    test('keys the cache per address', async () => {
        mockGetAccountChainStateRow.mockResolvedValue(storedRow)

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
        expect(mockGetAccountChainStateRow).toHaveBeenCalledTimes(2)
    })
})
