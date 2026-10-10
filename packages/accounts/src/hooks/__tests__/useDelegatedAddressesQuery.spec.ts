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
import { useDelegatedAddressesQuery } from '../useDelegatedAddressesQuery'
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

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

describe('useDelegatedAddressesQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('builds the expected query key', () => {
        expect(getDelegatedAddressesQueryKey('ADDR', MAINNET_SCOPE)).toEqual([
            'accounts',
            'delegated-addresses',
            { address: 'ADDR', scope: MAINNET_SCOPE },
        ])
    })

    it('returns the addresses rekeyed to the given address', async () => {
        mocks.fetchDelegatedAddresses.mockResolvedValue([
            'REKEYED1',
            'REKEYED2',
        ])

        const { result } = renderHook(
            () => useDelegatedAddressesQuery('ADDR', MAINNET_SCOPE),
            {
                wrapper: createWrapper(),
            },
        )

        await waitFor(() =>
            expect(result.current.delegatedAddresses).toEqual([
                'REKEYED1',
                'REKEYED2',
            ]),
        )
        expect(result.current.isError).toBe(false)
        expect(mocks.fetchDelegatedAddresses).toHaveBeenCalledWith(
            'ADDR',
            MAINNET_SCOPE,
        )
    })

    it('is disabled when address is empty', () => {
        const { result } = renderHook(
            () => useDelegatedAddressesQuery('', MAINNET_SCOPE),
            {
                wrapper: createWrapper(),
            },
        )

        expect(result.current.delegatedAddresses).toBeUndefined()
        expect(result.current.isLoading).toBe(false)
        expect(mocks.fetchDelegatedAddresses).not.toHaveBeenCalled()
    })
})
