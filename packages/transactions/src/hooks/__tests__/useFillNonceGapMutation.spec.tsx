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
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { UnsignedTransaction } from '@perawallet/wallet-core-chain-contract'
import { TransactionNotReplaceableError } from '../../errors'
import {
    transferChainAdapters,
    type TransferChainAdapter,
} from '../../transfer-adapter'
import { useFillNonceGapMutation } from '../useFillNonceGapMutation'

const mocks = vi.hoisted(() => ({
    getReplaceableSubmissionAttempt: vi.fn(),
    addSignRequest: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    getReplaceableSubmissionAttempt: mocks.getReplaceableSubmissionAttempt,
    useSigningRequest: () => ({ addSignRequest: mocks.addSignRequest }),
}))

const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

const FILL: UnsignedTransaction = {
    scope: SCOPE,
    payload: { nonce: 3 },
    summary: {
        kind: 'transfer',
        title: { key: 'transactions.list_item.cancel_transaction' },
        direction: 'self',
        icon: 'self',
    },
    chainData: { family: 'evm' },
}

const findBlockingGap =
    vi.fn<NonNullable<TransferChainAdapter['findBlockingGap']>>()
const buildGapFill = vi.fn<NonNullable<TransferChainAdapter['buildGapFill']>>()

const renderMutation = () => {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    })
    return renderHook(() => useFillNonceGapMutation(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        ),
    }).result
}

describe('useFillNonceGapMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        transferChainAdapters.reset()
        transferChainAdapters.register({
            chainId: SCOPE.chainId,
            build: vi.fn(),
            getFeeEstimate: vi.fn(),
            spendableBalance: vi.fn(),
            findBlockingGap,
            buildGapFill,
        })
        mocks.getReplaceableSubmissionAttempt.mockResolvedValue({
            id: 'attempt',
            rawTransaction: '0x02raw',
            nonce: 4,
        })
        findBlockingGap.mockResolvedValue(3)
        buildGapFill.mockResolvedValue([FILL])
    })

    it('queues a fill at the gap for review, replacing nothing', async () => {
        const result = renderMutation()

        await result.current.fill({ scope: SCOPE, txId: '0xpending' })

        expect(buildGapFill).toHaveBeenCalledWith(
            { rawTransaction: '0x02raw', sequence: 3 },
            { scope: SCOPE },
        )
        expect(mocks.addSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'transactions',
                transport: 'network',
                sourceType: 'replacement',
                txs: [FILL],
            }),
        )
        expect(mocks.addSignRequest.mock.calls[0][0]).not.toHaveProperty(
            'replacesTxId',
        )
    })

    it('refuses once the gap has filled', async () => {
        findBlockingGap.mockResolvedValue(null)
        const result = renderMutation()

        await expect(
            result.current.fill({ scope: SCOPE, txId: '0xpending' }),
        ).rejects.toBeInstanceOf(TransactionNotReplaceableError)
        expect(buildGapFill).not.toHaveBeenCalled()
        expect(mocks.addSignRequest).not.toHaveBeenCalled()
    })

    it('refuses once the send has settled', async () => {
        mocks.getReplaceableSubmissionAttempt.mockResolvedValue(null)
        const result = renderMutation()

        await expect(
            result.current.fill({ scope: SCOPE, txId: '0xpending' }),
        ).rejects.toBeInstanceOf(TransactionNotReplaceableError)
        expect(findBlockingGap).not.toHaveBeenCalled()
    })
})
