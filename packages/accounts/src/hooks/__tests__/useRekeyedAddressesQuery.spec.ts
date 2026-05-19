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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useRekeyedAddressesQuery } from '../useRekeyedAddressesQuery'
import { getRekeyedAddressesQueryKey } from '../querykeys'

const mocks = vi.hoisted(() => ({
    fetchRekeyedAddresses: vi.fn(),
}))

vi.mock('../../account-discovery', () => ({
    fetchRekeyedAddresses: mocks.fetchRekeyedAddresses,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

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

describe('useRekeyedAddressesQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('builds the expected query key', () => {
        expect(getRekeyedAddressesQueryKey('ADDR', 'mainnet')).toEqual([
            'accounts',
            'rekeyed-addresses',
            { address: 'ADDR', network: 'mainnet' },
        ])
    })

    it('returns the addresses rekeyed to the given address', async () => {
        mocks.fetchRekeyedAddresses.mockResolvedValue(['REKEYED1', 'REKEYED2'])

        const { result } = renderHook(() => useRekeyedAddressesQuery('ADDR'), {
            wrapper: createWrapper(),
        })

        await waitFor(() =>
            expect(result.current.rekeyedAddresses).toEqual([
                'REKEYED1',
                'REKEYED2',
            ]),
        )
        expect(result.current.isError).toBe(false)
        expect(mocks.fetchRekeyedAddresses).toHaveBeenCalledWith('ADDR')
    })

    it('is disabled when address is empty', () => {
        const { result } = renderHook(() => useRekeyedAddressesQuery(''), {
            wrapper: createWrapper(),
        })

        expect(result.current.rekeyedAddresses).toBeUndefined()
        expect(result.current.isLoading).toBe(false)
        expect(mocks.fetchRekeyedAddresses).not.toHaveBeenCalled()
    })
})
