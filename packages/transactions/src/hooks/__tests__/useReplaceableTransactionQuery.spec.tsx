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
import { useReplaceableTransactionQuery } from '../useReplaceableTransactionQuery'

const mocks = vi.hoisted(() => ({
    getReplaceableSubmissionAttempt: vi.fn(),
    supportsReplacement: true,
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
    getChainDescriptor: () => ({
        protocol: { supportsReplacement: mocks.supportsReplacement },
    }),
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

const renderQuery = (record?: TransactionRecord) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return renderHook(() => useReplaceableTransactionQuery(record), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        ),
    })
}

describe('useReplaceableTransactionQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.supportsReplacement = true
        mocks.ledgerListeners.clear()
        mocks.getReplaceableSubmissionAttempt.mockResolvedValue({ id: 'a' })
    })

    it('offers a pending transaction the ledger can re-price', async () => {
        const { result } = renderQuery(RECORD)

        await waitFor(() => expect(result.current.isReplaceable).toBe(true))
        expect(mocks.getReplaceableSubmissionAttempt).toHaveBeenCalledWith({
            scope: RECORD.scope,
            txId: '0xpending',
        })
    })

    it('offers nothing the ledger cannot re-price', async () => {
        mocks.getReplaceableSubmissionAttempt.mockResolvedValue(null)

        const { result } = renderQuery(RECORD)

        await waitFor(() =>
            expect(mocks.getReplaceableSubmissionAttempt).toHaveBeenCalled(),
        )
        expect(result.current.isReplaceable).toBe(false)
    })

    it.each([
        ['a chain without replacement', RECORD, false],
        ['a confirmed transaction', { ...RECORD, status: 'confirmed' }, true],
        ['no record', undefined, true],
    ] as const)(
        'never reads the ledger for %s',
        (_label, record, supportsReplacement) => {
            mocks.supportsReplacement = supportsReplacement

            const { result } = renderQuery(record as TransactionRecord)

            expect(result.current.isReplaceable).toBe(false)
            expect(mocks.getReplaceableSubmissionAttempt).not.toHaveBeenCalled()
        },
    )

    it('takes the offer away once the ledger records a newer attempt', async () => {
        const { result } = renderQuery(RECORD)
        await waitFor(() => expect(result.current.isReplaceable).toBe(true))

        mocks.getReplaceableSubmissionAttempt.mockResolvedValue(null)
        act(() => mocks.ledgerListeners.forEach(listener => listener()))

        await waitFor(() => expect(result.current.isReplaceable).toBe(false))
    })
})
