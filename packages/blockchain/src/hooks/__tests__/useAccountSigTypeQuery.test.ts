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

import { describe, test, expect, vi, beforeEach, type Mock } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import { useAccountSigTypeQuery } from '../useAccountSigTypeQuery'
import { useAlgorandClient } from '../useAlgorandClient'

vi.mock('../useAlgorandClient')

const mocks = vi.hoisted(() => ({
    useNetwork: vi.fn(),
}))

vi.mock('../useNetwork', () => ({
    useNetwork: mocks.useNetwork,
}))

const ADDRESS = 'A'.repeat(58)

describe('useAccountSigTypeQuery', () => {
    let queryClient: QueryClient
    let wrapper: React.FC<{ children: React.ReactNode }>
    let mockLookupAccountByID: Mock
    let mockDo: Mock

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useNetwork.mockReturnValue({ network: 'testnet' })

        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        wrapper = ({ children }) =>
            React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )

        mockDo = vi.fn().mockResolvedValue({
            account: { address: ADDRESS, sigType: 'pqsig' },
        })
        mockLookupAccountByID = vi.fn(() => ({
            exclude: () => ({ do: mockDo }),
        }))
        ;(useAlgorandClient as Mock).mockReturnValue({
            client: { indexer: { lookupAccountByID: mockLookupAccountByID } },
        })
    })

    test('reports the sig-type the indexer observed for the address', async () => {
        const { result } = renderHook(
            () => useAccountSigTypeQuery({ address: ADDRESS }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isFetching).toBe(false))

        expect(mockLookupAccountByID).toHaveBeenCalledWith(ADDRESS)
        expect(result.current.sigType).toBe('pqsig')
    })

    test('reports null for an account the indexer cannot classify (no sig-type)', async () => {
        mockDo.mockResolvedValue({ account: { address: ADDRESS } })

        const { result } = renderHook(
            () => useAccountSigTypeQuery({ address: ADDRESS }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isFetching).toBe(false))
        expect(result.current.sigType).toBeNull()
    })

    test('reports null for an unrecognized sig-type value instead of surfacing it', async () => {
        mockDo.mockResolvedValue({
            account: { address: ADDRESS, sigType: 'something-new' },
        })

        const { result } = renderHook(
            () => useAccountSigTypeQuery({ address: ADDRESS }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isFetching).toBe(false))
        expect(result.current.sigType).toBeNull()
    })

    test('treats an address the indexer has never seen (404) as unknown, not an error', async () => {
        const notFound = Object.assign(new Error('account not found'), {
            status: 404,
        })
        mockDo.mockRejectedValue(notFound)

        const { result } = renderHook(
            () => useAccountSigTypeQuery({ address: ADDRESS }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isFetching).toBe(false))
        expect(result.current.sigType).toBeNull()
        expect(
            queryClient.getQueryState([
                'blockchain',
                'account-sig-type',
                { address: ADDRESS, network: 'testnet' },
            ])?.status,
        ).toBe('success')
    })

    test('reports null while a non-404 failure leaves the sig-type unknown', async () => {
        mockDo.mockRejectedValue(
            Object.assign(new Error('indexer down'), { status: 503 }),
        )

        const { result } = renderHook(
            () => useAccountSigTypeQuery({ address: ADDRESS }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isFetching).toBe(false))
        expect(result.current.sigType).toBeNull()
    })

    test('does not fetch when disabled or when the address is empty', () => {
        renderHook(
            () => useAccountSigTypeQuery({ address: ADDRESS, enabled: false }),
            { wrapper },
        )
        renderHook(() => useAccountSigTypeQuery({ address: '' }), { wrapper })

        expect(mockLookupAccountByID).not.toHaveBeenCalled()
    })
})
