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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    type ChainId,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import {
    sendFlowChainAdapters,
    type SendFlowChainAdapter,
} from '../../chain-adapter'
import { useAssetInboxRequestsQuery } from '../useAssetInboxRequestsQuery'

const scope = { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const
const chainId: ChainId = scope.chainId

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapability: vi.fn(),
}))

const fetchRequests = vi.fn()

const adapter = {
    chainId,
    assetInbox: { fetchRequests },
} as unknown as SendFlowChainAdapter

describe('useAssetInboxRequestsQuery', () => {
    let queryClient: QueryClient

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useChainCapability).mockReturnValue(true)
        sendFlowChainAdapters.register(adapter)
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
    })

    afterEach(() => {
        sendFlowChainAdapters.reset()
    })

    it('fetches through the chain adapter with the scope it is given when assetInbox is on', async () => {
        fetchRequests.mockResolvedValue([{ id: '1' }])

        const { result } = renderHook(
            () => useAssetInboxRequestsQuery(scope, 'ADDR1'),
            { wrapper },
        )

        expect(result.current.isPending).toBe(true)
        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(useChainCapability).toHaveBeenCalledWith(chainId, 'assetInbox')
        expect(fetchRequests).toHaveBeenCalledWith({
            scope,
            address: 'ADDR1',
        })
        expect(result.current.data).toEqual([{ id: '1' }])
        expect(result.current.isUnavailableOnNetwork).toBe(false)
    })

    it("fetches through the adapter of the given scope's chain", async () => {
        const ethereumScope = {
            chainId: 'ethereum',
            networkId: 'sepolia',
        } as const
        const fetchEthereumRequests = vi.fn().mockResolvedValue([])
        sendFlowChainAdapters.register({
            chainId: ethereumScope.chainId,
            assetInbox: { fetchRequests: fetchEthereumRequests },
        } as unknown as SendFlowChainAdapter)

        const { result } = renderHook(
            () => useAssetInboxRequestsQuery(ethereumScope, 'ADDR1'),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(useChainCapability).toHaveBeenCalledWith(
            'ethereum',
            'assetInbox',
        )
        expect(fetchEthereumRequests).toHaveBeenCalledWith({
            scope: ethereumScope,
            address: 'ADDR1',
        })
        expect(fetchRequests).not.toHaveBeenCalled()
    })

    it('does not fetch without an address', () => {
        const { result } = renderHook(
            () => useAssetInboxRequestsQuery(scope, null),
            { wrapper },
        )

        expect(result.current.data).toEqual([])
        expect(result.current.isPending).toBe(false)
        expect(fetchRequests).not.toHaveBeenCalled()
    })

    it('reports unavailable, never fetches and is not pending when assetInbox is off', () => {
        vi.mocked(useChainCapability).mockReturnValue(false)

        const { result } = renderHook(
            () => useAssetInboxRequestsQuery(scope, 'ADDR1'),
            { wrapper },
        )

        expect(result.current.isUnavailableOnNetwork).toBe(true)
        expect(result.current.isPending).toBe(false)
        expect(result.current.data).toEqual([])
        expect(fetchRequests).not.toHaveBeenCalled()
    })

    it('surfaces a failed fetch as an error', async () => {
        const error = new Error('backend down')
        fetchRequests.mockRejectedValue(error)

        const { result } = renderHook(
            () => useAssetInboxRequestsQuery(scope, 'ADDR1'),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error).toBe(error)
    })
})
