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
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { TransactionRecord } from '@perawallet/wallet-core-chain-contract'
import {
    transferChainAdapters,
    type TransferChainAdapter,
} from '../../transfer-adapter'
import { useBlockingGapQuery } from '../useBlockingGapQuery'

const mocks = vi.hoisted(() => ({
    getReplaceableSubmissionAttempt: vi.fn(),
    ledgerListeners: new Set<() => void>(),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    getReplaceableSubmissionAttempt: mocks.getReplaceableSubmissionAttempt,
    subscribeToSubmissionLedger: (listener: () => void) => {
        mocks.ledgerListeners.add(listener)
        return () => mocks.ledgerListeners.delete(listener)
    },
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getChainDescriptor: () => ({ protocol: { supportsReplacement: true } }),
}))

const RECORD: TransactionRecord = {
    id: '0xpending',
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
    status: 'pending',
    summary: {
        kind: 'transfer',
        title: { key: 'transactions.list_item.send' },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'evm' },
}

const findBlockingGap =
    vi.fn<NonNullable<TransferChainAdapter['findBlockingGap']>>()

const renderQuery = (record?: TransactionRecord) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return renderHook(() => useBlockingGapQuery(record), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        ),
    })
}

describe('useBlockingGapQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.ledgerListeners.clear()
        transferChainAdapters.reset()
        transferChainAdapters.register({
            chainId: 'ethereum',
            build: vi.fn(),
            getFeeEstimate: vi.fn(),
            spendableBalance: vi.fn(),
            findBlockingGap,
        })
        mocks.getReplaceableSubmissionAttempt.mockResolvedValue({
            id: 'a',
            rawTransaction: '0x02raw',
        })
        findBlockingGap.mockResolvedValue(3)
    })

    it('flags a pending send the chain finds a gap below', async () => {
        const { result } = renderQuery(RECORD)

        await waitFor(() => expect(result.current.isBlocked).toBe(true))
        expect(findBlockingGap).toHaveBeenCalledWith(
            { rawTransaction: '0x02raw' },
            { scope: RECORD.scope },
        )
    })

    it('flags nothing when the chain finds no gap', async () => {
        findBlockingGap.mockResolvedValue(null)

        const { result } = renderQuery(RECORD)

        await waitFor(() => expect(findBlockingGap).toHaveBeenCalled())
        expect(result.current.isBlocked).toBe(false)
    })

    it('asks the chain nothing for a send the ledger cannot re-price', async () => {
        mocks.getReplaceableSubmissionAttempt.mockResolvedValue(null)

        const { result } = renderQuery(RECORD)

        await waitFor(() =>
            expect(mocks.getReplaceableSubmissionAttempt).toHaveBeenCalled(),
        )
        expect(findBlockingGap).not.toHaveBeenCalled()
        expect(result.current.isBlocked).toBe(false)
    })

    it('reads nothing for a record that is not pending', () => {
        const { result } = renderQuery({ ...RECORD, status: 'confirmed' })

        expect(result.current.isBlocked).toBe(false)
        expect(mocks.getReplaceableSubmissionAttempt).not.toHaveBeenCalled()
    })

    it('re-reads when the ledger changes', async () => {
        findBlockingGap.mockResolvedValueOnce(null).mockResolvedValue(3)
        const { result } = renderQuery(RECORD)
        await waitFor(() => expect(findBlockingGap).toHaveBeenCalledTimes(1))

        act(() => mocks.ledgerListeners.forEach(listener => listener()))

        await waitFor(() => expect(result.current.isBlocked).toBe(true))
    })
})
