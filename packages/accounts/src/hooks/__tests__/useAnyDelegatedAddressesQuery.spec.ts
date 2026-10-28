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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useAnyDelegatedAddressesQuery } from '../useAnyDelegatedAddressesQuery'
import { getDelegatedAddressesQueryKey } from '../querykeys'

import {
    fakeAccountsChain,
    MAINNET_SCOPE,
} from '../../__tests__/fakeAccountsChain'

const mocks = {
    get fetchDelegatedAddresses() {
        return vi.mocked(
            fakeAccountsChain().adapter.authority!.fetchDelegatedAddresses,
        )
    },
}

const newClient = () =>
    new QueryClient({ defaultOptions: { queries: { retry: false } } })

const render = (addresses: string[], queryClient: QueryClient) =>
    renderHook(() => useAnyDelegatedAddressesQuery(addresses, MAINNET_SCOPE), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            ),
    })

describe('useAnyDelegatedAddressesQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('reports nothing delegated and every lookup done for no addresses', () => {
        const { result } = render([], newClient())

        expect(result.current).toEqual({
            hasDelegatedAddresses: false,
            isEveryLookupSuccessful: true,
        })
        expect(mocks.fetchDelegatedAddresses).not.toHaveBeenCalled()
    })

    it('reports nothing delegated once every lookup comes back empty', async () => {
        mocks.fetchDelegatedAddresses.mockResolvedValue([])

        const { result } = render(['A', 'B'], newClient())

        await waitFor(() =>
            expect(result.current.isEveryLookupSuccessful).toBe(true),
        )
        expect(result.current.hasDelegatedAddresses).toBe(false)
    })

    it('flags a delegation found on one of several addresses', async () => {
        mocks.fetchDelegatedAddresses.mockImplementation(
            async (address: string) => (address === 'B' ? ['DELEGATE'] : []),
        )

        const { result } = render(['A', 'B'], newClient())

        await waitFor(() =>
            expect(result.current.hasDelegatedAddresses).toBe(true),
        )
        expect(result.current.isEveryLookupSuccessful).toBe(true)
    })

    it('is not every-successful when one lookup rejects', async () => {
        mocks.fetchDelegatedAddresses.mockImplementation(
            async (address: string) => {
                if (address === 'B') throw new Error('indexer down')
                return []
            },
        )
        const client = newClient()

        const { result } = render(['A', 'B'], client)

        await waitFor(() =>
            expect(
                client.getQueryState(
                    getDelegatedAddressesQueryKey('B', MAINNET_SCOPE),
                )?.status,
            ).toBe('error'),
        )
        expect(result.current.isEveryLookupSuccessful).toBe(false)
        expect(result.current.hasDelegatedAddresses).toBe(false)
    })

    it('is not every-successful while a lookup never resolves', () => {
        mocks.fetchDelegatedAddresses.mockImplementation(
            () => new Promise(() => undefined),
        )

        const { result } = render(['A'], newClient())

        expect(result.current.isEveryLookupSuccessful).toBe(false)
    })

    it('reads data seeded under the shared key without fetching', () => {
        const client = newClient()
        client.setQueryData(getDelegatedAddressesQueryKey('A', MAINNET_SCOPE), [
            'DELEGATE',
        ])

        const { result } = render(['A'], client)

        expect(result.current).toEqual({
            hasDelegatedAddresses: true,
            isEveryLookupSuccessful: true,
        })
        expect(mocks.fetchDelegatedAddresses).not.toHaveBeenCalled()
    })
})
