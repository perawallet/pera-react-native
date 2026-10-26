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

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type {
    TransactionSummary,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { TransactionNotReplaceableError } from '../../errors'
import {
    transferChainAdapters,
    type TransferChainAdapter,
} from '../../transfer-adapter'
import { useReplaceTransactionMutation } from '../useReplaceTransactionMutation'

const mocks = vi.hoisted(() => ({
    getReplaceableSubmissionAttempt: vi.fn(),
    addSignRequest: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    getReplaceableSubmissionAttempt: mocks.getReplaceableSubmissionAttempt,
    useSigningRequest: () => ({ addSignRequest: mocks.addSignRequest }),
}))

const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

const SUMMARY: TransactionSummary = {
    kind: 'transfer',
    title: { key: 'transactions.list_item.send' },
    direction: 'out',
    icon: 'send',
}

const REPLACEMENT: UnsignedTransaction = {
    scope: SCOPE,
    payload: { nonce: 4 },
    summary: SUMMARY,
    chainData: { family: 'evm' },
}

const buildReplacement =
    vi.fn<NonNullable<TransferChainAdapter['buildReplacement']>>()

const registerAdapter = (withReplacement: boolean) => {
    transferChainAdapters.reset()
    transferChainAdapters.register({
        chainId: SCOPE.chainId,
        build: vi.fn(),
        getFeeEstimate: vi.fn(),
        spendableBalance: vi.fn(),
        ...(withReplacement && { buildReplacement }),
    })
}

const renderMutation = () => {
    const queryClient = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
    })
    return renderHook(() => useReplaceTransactionMutation(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        ),
    }).result
}

describe('useReplaceTransactionMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registerAdapter(true)
        buildReplacement.mockResolvedValue([REPLACEMENT])
        mocks.getReplaceableSubmissionAttempt.mockResolvedValue({
            id: 'attempt',
            rawTransaction: '0x02raw',
            nonce: 4,
            historyEntry: {
                summary: {
                    ...SUMMARY,
                    notice: { kind: 'warning', title: { key: 'pending' } },
                },
                chainData: { family: 'evm' },
            },
        })
    })

    it('queues the replacement for review, naming the transaction it replaces', async () => {
        const result = renderMutation()

        await result.current.replace({
            scope: SCOPE,
            txId: '0xpending',
            kind: 'speed-up',
        })

        expect(buildReplacement).toHaveBeenCalledWith(
            { kind: 'speed-up', rawTransaction: '0x02raw', summary: SUMMARY },
            { scope: SCOPE },
        )
        expect(mocks.addSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'transactions',
                transport: 'network',
                sourceType: 'replacement',
                txs: [REPLACEMENT],
                replacesTxId: '0xpending',
            }),
        )
    })

    it('builds without a summary when the ledger holds none', async () => {
        mocks.getReplaceableSubmissionAttempt.mockResolvedValue({
            id: 'attempt',
            rawTransaction: '0x02raw',
            nonce: 4,
            historyEntry: null,
        })
        const result = renderMutation()

        await result.current.replace({
            scope: SCOPE,
            txId: '0xpending',
            kind: 'cancel',
        })

        expect(buildReplacement).toHaveBeenCalledWith(
            { kind: 'cancel', rawTransaction: '0x02raw', summary: undefined },
            { scope: SCOPE },
        )
    })

    it('refuses a transaction that settled since it was offered', async () => {
        mocks.getReplaceableSubmissionAttempt.mockResolvedValue(null)
        const result = renderMutation()

        await expect(
            result.current.replace({
                scope: SCOPE,
                txId: '0xpending',
                kind: 'speed-up',
            }),
        ).rejects.toBeInstanceOf(TransactionNotReplaceableError)
        expect(mocks.addSignRequest).not.toHaveBeenCalled()
    })

    it('refuses on a chain that cannot build a replacement', async () => {
        registerAdapter(false)
        const result = renderMutation()

        await expect(
            result.current.replace({
                scope: SCOPE,
                txId: '0xpending',
                kind: 'cancel',
            }),
        ).rejects.toBeInstanceOf(TransactionNotReplaceableError)
        expect(mocks.addSignRequest).not.toHaveBeenCalled()
    })
})
