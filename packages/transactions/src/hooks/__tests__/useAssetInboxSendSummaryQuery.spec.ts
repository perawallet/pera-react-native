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
import { useAssetInboxSendSummaryQuery } from '../useAssetInboxSendSummaryQuery'

const scope = { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const
const chainId: ChainId = scope.chainId

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapability: vi.fn(),
}))

const fetchSendSummary = vi.fn()

const adapter = {
    chainId,
    assetInbox: { fetchSendSummary },
} as unknown as SendFlowChainAdapter

const RECEIVER = 'RECEIVER'
const ASSET_ID = '12345'
const summary = { quote: { opaque: true }, fundingAmount: 100_000n }

describe('useAssetInboxSendSummaryQuery', () => {
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

    it('fetches the summary through the chain adapter when assetInbox is on', async () => {
        fetchSendSummary.mockResolvedValue(summary)

        const { result } = renderHook(
            () => useAssetInboxSendSummaryQuery(scope, RECEIVER, ASSET_ID),
            { wrapper },
        )

        expect(result.current.isLoading).toBe(true)
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(useChainCapability).toHaveBeenCalledWith(chainId, 'assetInbox')
        expect(fetchSendSummary).toHaveBeenCalledWith({
            scope,
            receiver: RECEIVER,
            assetId: ASSET_ID,
        })
        expect(result.current.data).toEqual(summary)
        expect(result.current.isUnavailableOnNetwork).toBe(false)
    })

    it.each([
        ['an empty receiver', '', ASSET_ID],
        ['an empty asset id', RECEIVER, ''],
    ])('does not fetch with %s', async (_, receiver, assetId) => {
        const { result } = renderHook(
            () => useAssetInboxSendSummaryQuery(scope, receiver, assetId),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(fetchSendSummary).not.toHaveBeenCalled()
        expect(result.current.data).toBeUndefined()
    })

    it('reports unavailable, never fetches and is not loading when assetInbox is off', () => {
        vi.mocked(useChainCapability).mockReturnValue(false)

        const { result } = renderHook(
            () => useAssetInboxSendSummaryQuery(scope, RECEIVER, ASSET_ID),
            { wrapper },
        )

        expect(result.current.isUnavailableOnNetwork).toBe(true)
        expect(result.current.isLoading).toBe(false)
        expect(fetchSendSummary).not.toHaveBeenCalled()
    })

    it('surfaces a failed fetch as an error', async () => {
        const error = new Error('backend down')
        fetchSendSummary.mockRejectedValue(error)

        const { result } = renderHook(
            () => useAssetInboxSendSummaryQuery(scope, RECEIVER, ASSET_ID),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error).toBe(error)
    })
})
