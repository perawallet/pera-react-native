/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { Linking } from 'react-native'
import { type CardTransaction } from '@perawallet/wallet-core-card'

const mockState = vi.hoisted(() => ({
    routeTransactionId: 'row_1',
    transactions: [] as CardTransaction[],
    isError: false,
    isFetching: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
}))
const mockErrorToast = vi.fn()

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        errorToast: mockErrorToast,
        infoToast: vi.fn(),
        successToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useRoute: () => ({
            params: { transactionId: mockState.routeTransactionId },
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

// Interpolation values must survive so the mailto assertion can see the id.
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
        mockState.routeTransactionId = 'row_1'
        mockState.transactions = []
        mockState.isError = false
        mockState.isFetching = false
        mockState.hasNextPage = false
        vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
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
        mockState.routeTransactionId = 'missing'
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
        mockState.routeTransactionId = 'missing'
        mockState.isError = true

        const { result } = renderHook(() => useCardTransactionDetailScreen())

        expect(result.current.isError).toBe(true)
    })

    it('auto-paginates while the row is absent and more pages exist', () => {
        mockState.routeTransactionId = 'on_page_2'
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
        mockState.routeTransactionId = 'missing'
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

    it('opens a support mailto containing the processor transaction id', () => {
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

        expect(Linking.openURL).toHaveBeenCalledTimes(1)
        const url = vi.mocked(Linking.openURL).mock.calls[0][0]
        expect(url.startsWith('mailto:support@baanx.com?subject=')).toBe(true)
        expect(url).toContain('auth_1001')
        expect(url).toContain('&body=')
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

        expect(vi.mocked(Linking.openURL).mock.calls[0][0]).toContain('row_1')
    })

    it('does not open the mail composer when no transaction is loaded', () => {
        mockState.routeTransactionId = 'missing'

        const { result } = renderHook(() => useCardTransactionDetailScreen())
        result.current.onReportTransaction()

        expect(Linking.openURL).not.toHaveBeenCalled()
    })

    it('shows an error toast when no mail client can open the mailto url', async () => {
        vi.spyOn(Linking, 'openURL').mockRejectedValue(
            new Error('Unable to open URL'),
        )
        mockState.transactions = [tx({ id: 'row_1', transactionId: 'a_1' })]

        const { result } = renderHook(() => useCardTransactionDetailScreen())
        result.current.onReportTransaction()

        await vi.waitFor(() => expect(mockErrorToast).toHaveBeenCalledTimes(1))
    })

    it('does not toast when the mail composer opens', async () => {
        mockState.transactions = [tx({ id: 'row_1', transactionId: 'a_1' })]

        const { result } = renderHook(() => useCardTransactionDetailScreen())
        result.current.onReportTransaction()

        await vi.waitFor(() => expect(Linking.openURL).toHaveBeenCalled())
        expect(mockErrorToast).not.toHaveBeenCalled()
    })
})
