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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CardTransaction } from '@perawallet/wallet-core-card'

const mockState = vi.hoisted(() => ({
    routeId: 'row_1',
    transactions: [] as CardTransaction[],
    isError: false,
    isFetching: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
}))
const mockSendEmail = vi.fn()

vi.mock('@hooks/useSendEmail', () => ({
    useSendEmail: () => ({ sendEmail: mockSendEmail }),
}))

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useRoute: () => ({
            params: { id: mockState.routeId },
        }),
    }
})

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardTransactionsQuery: () => ({
            transactions: mockState.transactions,
            isError: mockState.isError,
            isFetching: mockState.isFetching,
            hasNextPage: mockState.hasNextPage,
            fetchNextPage: mockState.fetchNextPage,
            refetch: mockState.refetch,
        }),
    }
})

// Interpolation values must survive so the report-email assertions can see the id.
vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<object>('react-i18next')
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, options?: Record<string, unknown>) =>
                options ? `${key} ${Object.values(options).join(' ')}` : key,
            i18n: { changeLanguage: vi.fn(), language: 'en' },
        }),
    }
})

import { useCardTransactionDetailScreen } from '../useCardTransactionDetailScreen'

const tx = (partial: Partial<CardTransaction>): CardTransaction =>
    partial as unknown as CardTransaction

describe('useCardTransactionDetailScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockState.routeId = 'row_1'
        mockState.transactions = []
        mockState.isError = false
        mockState.isFetching = false
        mockState.hasNextPage = false
    })

    it('finds the transaction matching the route param by row id', () => {
        mockState.transactions = [
            tx({ id: 'row_1', transactionId: 'auth_1001' }),
            tx({ id: 'row_2', transactionId: 'auth_1002' }),
        ]

        const { result } = renderHook(() => useCardTransactionDetailScreen())

        expect(result.current.transaction?.transactionId).toBe('auth_1001')
    })

    it('reports loading while any fetch is in flight and the row is absent', () => {
        mockState.routeId = 'missing'
        mockState.isFetching = true

        const { result } = renderHook(() => useCardTransactionDetailScreen())

        expect(result.current.transaction).toBeUndefined()
        expect(result.current.isLoading).toBe(true)
    })

    it('does not report loading once the row is found, even mid-fetch', () => {
        mockState.transactions = [tx({ id: 'row_1' })]
        mockState.isFetching = true

        const { result } = renderHook(() => useCardTransactionDetailScreen())

        expect(result.current.isLoading).toBe(false)
    })

    it('passes the query error state through', () => {
        mockState.routeId = 'missing'
        mockState.isError = true

        const { result } = renderHook(() => useCardTransactionDetailScreen())

        expect(result.current.isError).toBe(true)
    })

    it('auto-paginates while the row is absent and more pages exist', () => {
        mockState.routeId = 'on_page_2'
        mockState.transactions = [tx({ id: 'row_1' })]
        mockState.hasNextPage = true

        renderHook(() => useCardTransactionDetailScreen())

        expect(mockState.fetchNextPage).toHaveBeenCalledTimes(1)
    })

    it('does not paginate once the row is found', () => {
        mockState.transactions = [tx({ id: 'row_1' })]
        mockState.hasNextPage = true

        renderHook(() => useCardTransactionDetailScreen())

        expect(mockState.fetchNextPage).not.toHaveBeenCalled()
    })

    it('does not paginate while a fetch is already in flight or errored', () => {
        mockState.routeId = 'missing'
        mockState.hasNextPage = true
        mockState.isFetching = true
        renderHook(() => useCardTransactionDetailScreen())
        expect(mockState.fetchNextPage).not.toHaveBeenCalled()

        mockState.isFetching = false
        mockState.isError = true
        renderHook(() => useCardTransactionDetailScreen())
        expect(mockState.fetchNextPage).not.toHaveBeenCalled()
    })

    it('refetches on retry', () => {
        const { result } = renderHook(() => useCardTransactionDetailScreen())

        result.current.handleRetry()

        expect(mockState.refetch).toHaveBeenCalledTimes(1)
    })

    it('sends a support email to the card inbox with the processor id in subject and body', () => {
        mockState.transactions = [
            tx({
                id: 'row_1',
                transactionId: 'auth_1001',
                dateTime: '2024-12-24T13:10:00Z',
                merchantName: 'Sesame Street Cafe',
            }),
        ]

        const { result } = renderHook(() => useCardTransactionDetailScreen())
        result.current.onReportTransaction()

        expect(mockSendEmail).toHaveBeenCalledTimes(1)
        const args = mockSendEmail.mock.calls[0][0]
        expect(args.to).toBe('support@baanx.com')
        expect(args.subject).toContain('auth_1001')
        expect(args.body).toContain('auth_1001')
    })

    it('falls back to the row id in the report email when the processor id is empty', () => {
        mockState.transactions = [
            tx({
                id: 'row_1',
                transactionId: '',
                dateTime: '2024-12-24T13:10:00Z',
            }),
        ]

        const { result } = renderHook(() => useCardTransactionDetailScreen())
        result.current.onReportTransaction()

        expect(mockSendEmail.mock.calls[0][0].subject).toContain('row_1')
    })

    it('does not send an email when no transaction is loaded', () => {
        mockState.routeId = 'missing'

        const { result } = renderHook(() => useCardTransactionDetailScreen())
        result.current.onReportTransaction()

        expect(mockSendEmail).not.toHaveBeenCalled()
    })
})
