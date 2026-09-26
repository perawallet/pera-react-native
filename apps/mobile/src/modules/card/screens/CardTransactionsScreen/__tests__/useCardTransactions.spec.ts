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

import { renderHook, waitFor } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CardTransaction } from '@perawallet/wallet-core-chain-algorand/card'

const mockQuery = vi.hoisted(() => ({
    transactions: [] as CardTransaction[],
    isLoading: false,
    isFetchingNextPage: false,
    isError: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
}))
const mocks = vi.hoisted(() => ({
    exportStatement: vi.fn(),
    shareFile: vi.fn(),
    showExportError: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-chain-algorand/card', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-chain-algorand/card',
    )
    return {
        ...actual,
        useCardTransactionsQuery: () => mockQuery,
        useExportCardStatementMutation: () => ({
            mutateAsync: mocks.exportStatement,
            isPending: false,
        }),
    }
})

vi.mock('../../../hooks', () => ({
    useCardErrorToast: () => mocks.showExportError,
}))
vi.mock('@utils/shareFile', () => ({ shareFile: mocks.shareFile }))

import { useCardTransactions } from '../useCardTransactions'

const tx = (id: string, dateTime: string): CardTransaction =>
    ({ id, dateTime }) as unknown as CardTransaction

describe('useCardTransactions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockQuery.transactions = []
        mockQuery.isLoading = false
        mockQuery.isFetchingNextPage = false
        mockQuery.isError = false
        mockQuery.hasNextPage = false
    })

    it('groups transactions into month sections, newest first', () => {
        mockQuery.transactions = [
            tx('a', '2026-06-10T10:00:00Z'),
            tx('b', '2026-07-15T10:00:00Z'),
        ]

        const { result } = renderHook(() => useCardTransactions())

        expect(result.current.sections.map(s => s.key)).toEqual([
            '2026-07',
            '2026-06',
        ])
        expect(result.current.isEmpty).toBe(false)
    })

    it('reports empty only after loading settles', () => {
        mockQuery.isLoading = true
        const { result: loading } = renderHook(() => useCardTransactions())
        expect(loading.current.isEmpty).toBe(false)

        mockQuery.isLoading = false
        const { result: settled } = renderHook(() => useCardTransactions())
        expect(settled.current.isEmpty).toBe(true)
    })

    it('fetches the next page only when one exists and none is in flight', () => {
        mockQuery.hasNextPage = true
        const { result } = renderHook(() => useCardTransactions())

        result.current.handleLoadMore()

        expect(mockQuery.fetchNextPage).toHaveBeenCalledTimes(1)
    })

    it('does not fetch the next page while one is already loading', () => {
        mockQuery.hasNextPage = true
        mockQuery.isFetchingNextPage = true
        const { result } = renderHook(() => useCardTransactions())

        result.current.handleLoadMore()

        expect(mockQuery.fetchNextPage).not.toHaveBeenCalled()
    })

    it('does not fetch when there is no next page', () => {
        mockQuery.hasNextPage = false
        const { result } = renderHook(() => useCardTransactions())

        result.current.handleLoadMore()

        expect(mockQuery.fetchNextPage).not.toHaveBeenCalled()
    })

    it('refetches on retry', () => {
        const { result } = renderHook(() => useCardTransactions())

        result.current.handleRetry()

        expect(mockQuery.refetch).toHaveBeenCalledTimes(1)
    })

    it('exports the PDF statement and hands it to the share sheet', async () => {
        const bytes = new Uint8Array([37, 80, 68, 70])
        mocks.exportStatement.mockResolvedValue({ format: 'PDF', bytes })
        const { result } = renderHook(() => useCardTransactions())

        result.current.onExport()
        await waitFor(() => expect(mocks.shareFile).toHaveBeenCalled())

        expect(mocks.exportStatement).toHaveBeenCalledWith({ format: 'PDF' })
        expect(mocks.shareFile).toHaveBeenCalledWith(
            expect.stringMatching(
                /^pera-card-statement-\d{4}-\d{2}-\d{2}\.pdf$/,
            ),
            bytes,
            { mimeType: 'application/pdf' },
        )
        expect(mocks.showExportError).not.toHaveBeenCalled()
    })

    it('surfaces an export failure as a toast and shares nothing', async () => {
        mocks.exportStatement.mockRejectedValue(new Error('boom'))
        const { result } = renderHook(() => useCardTransactions())

        result.current.onExport()
        await waitFor(() => expect(mocks.showExportError).toHaveBeenCalled())

        expect(mocks.shareFile).not.toHaveBeenCalled()
    })
})
