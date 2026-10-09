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
import React from 'react'
import { getOnChainAccountStateQueryKey } from '../querykeys'
import {
    fetchOnChainAccountState,
    useOnChainAccountStateQuery,
} from '../useOnChainAccountStateQuery'
import {
    fakeAccountStateSnapshot,
    fakeAccountsChain,
    MAINNET_SCOPE,
    TESTNET_SCOPE,
} from '../../__tests__/fakeAccountsChain'

const ADDRESS = 'FAKE-ADDRESS'

const fetchAccountState = () =>
    vi.mocked(fakeAccountsChain().adapter.fetchAccountState)

describe('useOnChainAccountStateQuery', () => {
    let queryClient: QueryClient
    let wrapper: React.FC<{ children: React.ReactNode }>

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        wrapper = ({ children }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )
    })

    test("reads the account's state on the scope through the chain's adapter, as a first read", async () => {
        const snapshot = fakeAccountStateSnapshot(250)
        fetchAccountState().mockResolvedValue(snapshot)

        const { result } = renderHook(
            () => useOnChainAccountStateQuery(ADDRESS, TESTNET_SCOPE),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toBe(snapshot)
        expect(fetchAccountState()).toHaveBeenCalledWith(
            ADDRESS,
            TESTNET_SCOPE,
            { priorResourceCount: 0 },
        )
        expect(
            queryClient.getQueryData(
                getOnChainAccountStateQueryKey(ADDRESS, TESTNET_SCOPE),
            ),
        ).toBe(snapshot)
    })

    test('serves the fresh cache on remount instead of refetching', async () => {
        fetchAccountState().mockResolvedValue(fakeAccountStateSnapshot())

        const first = renderHook(
            () => useOnChainAccountStateQuery(ADDRESS, MAINNET_SCOPE),
            { wrapper },
        )
        await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
        first.unmount()

        const second = renderHook(
            () => useOnChainAccountStateQuery(ADDRESS, MAINNET_SCOPE),
            { wrapper },
        )
        await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

        expect(fetchAccountState()).toHaveBeenCalledTimes(1)
    })

    test('is disabled when the address is empty', () => {
        const { result } = renderHook(
            () => useOnChainAccountStateQuery('', MAINNET_SCOPE),
            { wrapper },
        )

        expect(result.current.isFetching).toBe(false)
        expect(result.current.isPending).toBe(true)
        expect(fetchAccountState()).not.toHaveBeenCalled()
    })

    test('surfaces a failed read as an error', async () => {
        fetchAccountState().mockRejectedValue(new Error('node down'))

        const { result } = renderHook(
            () => useOnChainAccountStateQuery(ADDRESS, MAINNET_SCOPE),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.data).toBeUndefined()
    })
})

describe('fetchOnChainAccountState', () => {
    test('resolves what the chain reads', async () => {
        const snapshot = fakeAccountStateSnapshot(7)
        fetchAccountState().mockResolvedValue(snapshot)

        await expect(
            fetchOnChainAccountState(ADDRESS, MAINNET_SCOPE),
        ).resolves.toBe(snapshot)
    })
})
