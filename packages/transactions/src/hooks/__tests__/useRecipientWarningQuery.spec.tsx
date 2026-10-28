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
    type AssetRef,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import {
    transferChainAdapters,
    type ChainNotice,
    type RecipientWarningInput,
    type TransferChainAdapter,
} from '../../transfer-adapter'
import { useRecipientWarningQuery } from '../useRecipientWarningQuery'

const SCOPE = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const
const ALGO: AssetRef = { chainId: SCOPE.chainId, assetId: '0' }
const INPUT: RecipientWarningInput = {
    recipient: 'RECEIVER',
    asset: ALGO,
    amount: new Decimal(50_000),
    scope: SCOPE,
}
const NOTICE: ChainNotice = {
    title: { key: 'recipient.title' },
    body: [{ key: 'recipient.body', params: { min: '0.1' } }],
}

const recipientWarning =
    vi.fn<NonNullable<TransferChainAdapter['recipientWarning']>>()

const wrapper =
    (queryClient: QueryClient) =>
    ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )

const registerAdapter = (withWarning: boolean) => {
    transferChainAdapters.reset()
    transferChainAdapters.register({
        chainId: SCOPE.chainId,
        build: vi.fn(),
        getFeeEstimate: vi.fn(),
        spendableBalance: vi.fn(),
        ...(withWarning ? { recipientWarning } : {}),
    })
}

describe('useRecipientWarningQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        registerAdapter(true)
    })

    const render = (input: RecipientWarningInput | undefined) =>
        renderHook(() => useRecipientWarningQuery(input), {
            wrapper: wrapper(queryClient),
        })

    it('waits, without reporting pending, until it has an input', () => {
        const { result } = render(undefined)

        expect(result.current).toEqual({ data: undefined, isPending: false })
        expect(recipientWarning).not.toHaveBeenCalled()
    })

    it("surfaces the chain's warning, pending until it answers", async () => {
        recipientWarning.mockResolvedValue(NOTICE)

        const { result } = render(INPUT)

        expect(result.current.isPending).toBe(true)
        await waitFor(() => expect(result.current.data).toEqual(NOTICE))
        expect(result.current.isPending).toBe(false)
        expect(recipientWarning).toHaveBeenCalledWith(INPUT)
    })

    it('reads no warning when the chain has none for the send', async () => {
        recipientWarning.mockResolvedValue(undefined)

        const { result } = render(INPUT)

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.data).toBeUndefined()
    })

    it('lets the send through when the recipient read fails', async () => {
        recipientWarning.mockRejectedValue(new Error('node down'))

        const { result } = render(INPUT)

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.data).toBeUndefined()
    })

    it('neither asks nor waits on a chain with no recipient rule', () => {
        registerAdapter(false)

        const { result } = render(INPUT)

        expect(result.current).toEqual({ data: undefined, isPending: false })
    })
})
