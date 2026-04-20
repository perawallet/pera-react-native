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

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useOnChainAccountInformationQuery } from '../useOnChainAccountInformationQuery'

const mockAccountInformation = vi.fn()
const mockAlgokit = {
    client: { algod: { accountInformation: mockAccountInformation } },
}

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: () => mockAlgokit,
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

describe('useOnChainAccountInformationQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not run the query when address is empty', () => {
        const { result } = renderHook(
            () => useOnChainAccountInformationQuery(''),
            {
                wrapper: createWrapper(),
            },
        )

        expect(result.current.isFetching).toBe(false)
        expect(mockAccountInformation).not.toHaveBeenCalled()
    })

    it('fetches and maps on-chain account information', async () => {
        mockAccountInformation.mockResolvedValue({
            address: 'ADDR1',
            amount: 1000n,
            minBalance: 100n,
            status: 'Online',
            rewards: 0n,
            assets: [{ assetId: 1n, amount: 5n, isFrozen: false }],
        })

        const { result } = renderHook(
            () => useOnChainAccountInformationQuery('ADDR1'),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(mockAccountInformation).toHaveBeenCalledWith('ADDR1')
        expect(result.current.data).toEqual({
            address: 'ADDR1',
            amount: 1000n,
            minBalance: 100n,
            status: 'Online',
            rewards: 0n,
            assets: [{ assetId: 1n, amount: 5n, isFrozen: false }],
        })
    })
})
