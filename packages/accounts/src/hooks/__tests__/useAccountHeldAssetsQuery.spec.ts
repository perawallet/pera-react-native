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
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

const mocks = vi.hoisted(() => ({ getAccountHeldAssets: vi.fn() }))

vi.mock('../../db', () => ({
    getAccountHeldAssets: mocks.getAccountHeldAssets,
}))

import { invalidateAccountQueriesForAddresses } from '../querykeys'
import { useAccountHeldAssetsQuery } from '../useAccountHeldAssetsQuery'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const SOURCES = [{ address: 'ADDR1', scope: SCOPE }]

const setup = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
    return { queryClient, wrapper }
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('useAccountHeldAssetsQuery', () => {
    it('returns the held assets read for the sources', async () => {
        mocks.getAccountHeldAssets.mockResolvedValue([
            { scope: SCOPE, assetId: '31566704' },
        ])
        const { wrapper } = setup()

        const { result } = renderHook(
            () => useAccountHeldAssetsQuery(SOURCES),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.heldAssets).toEqual([
                { scope: SCOPE, assetId: '31566704' },
            ]),
        )
        expect(mocks.getAccountHeldAssets).toHaveBeenCalledWith({
            sources: SOURCES,
        })
    })

    it('reads nothing, and holds nothing, without sources', () => {
        const { wrapper } = setup()

        const { result } = renderHook(() => useAccountHeldAssetsQuery([]), {
            wrapper,
        })

        expect(result.current.heldAssets).toEqual([])
        expect(mocks.getAccountHeldAssets).not.toHaveBeenCalled()
    })

    it("reads again when a sync invalidates one of its sources' addresses", async () => {
        mocks.getAccountHeldAssets.mockResolvedValue([])
        const { queryClient, wrapper } = setup()
        renderHook(() => useAccountHeldAssetsQuery(SOURCES), { wrapper })
        await waitFor(() =>
            expect(mocks.getAccountHeldAssets).toHaveBeenCalledTimes(1),
        )

        invalidateAccountQueriesForAddresses(queryClient, ['ADDR1'])

        await waitFor(() =>
            expect(mocks.getAccountHeldAssets).toHaveBeenCalledTimes(2),
        )
    })
})
