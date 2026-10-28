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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import {
    LEGACY_CHAIN_ID,
    type FeeEstimate,
    type TransferIntent,
} from '@perawallet/wallet-core-chain-contract'
import {
    transferChainAdapters,
    type TransferChainAdapter,
} from '../../transfer-adapter'
import {
    useTransferFeeEstimateQuery,
    type TransferFeeEstimateInput,
} from '../useTransferFeeEstimateQuery'

const SCOPE = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const
const INTENT: TransferIntent = {
    kind: 'transfer',
    from: 'SENDER',
    to: 'RECEIVER',
    assetRef: { chainId: SCOPE.chainId, assetId: '0' },
    amount: new Decimal(1_000),
}
const ESTIMATE: FeeEstimate = {
    assetRef: { chainId: SCOPE.chainId, assetId: '0' },
    amount: new Decimal(21_000),
}

const getFeeEstimate = vi.fn<TransferChainAdapter['getFeeEstimate']>()

const wrapper =
    (queryClient: QueryClient) =>
    ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )

describe('useTransferFeeEstimateQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        transferChainAdapters.reset()
        transferChainAdapters.register({
            chainId: SCOPE.chainId,
            build: vi.fn(),
            getFeeEstimate,
            spendableBalance: vi.fn(),
        })
    })

    const render = (input: TransferFeeEstimateInput | undefined) =>
        renderHook(() => useTransferFeeEstimateQuery(input), {
            wrapper: wrapper(queryClient),
        })

    it('prices the intent through the chain transfer adapter', async () => {
        getFeeEstimate.mockResolvedValue(ESTIMATE)

        const { result } = render({ intent: INTENT, scope: SCOPE })

        await waitFor(() => expect(result.current.data).toEqual(ESTIMATE))
        expect(getFeeEstimate).toHaveBeenCalledWith(INTENT, { scope: SCOPE })
        expect(result.current.isPending).toBe(false)
    })

    it('stays idle and not pending without an input', () => {
        const { result } = render(undefined)

        expect(getFeeEstimate).not.toHaveBeenCalled()
        expect(result.current.data).toBeUndefined()
        expect(result.current.isPending).toBe(false)
    })

    it('reports a failed estimate', async () => {
        getFeeEstimate.mockRejectedValue(new Error('rpc down'))

        const { result } = render({ intent: INTENT, scope: SCOPE })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.data).toBeUndefined()
    })
})
