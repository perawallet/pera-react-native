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
import { act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CardTransaction } from '@perawallet/wallet-core-card'
import { CardEvent } from '@analytics'

const { mockTrackEvent } = vi.hoisted(() => ({ mockTrackEvent: vi.fn() }))
vi.mock('@analytics', async () => {
    const actual = await vi.importActual<object>('@analytics')
    return { ...actual, trackEvent: mockTrackEvent }
})

const mocks = vi.hoisted(() => ({
    transactions: [] as unknown[],
    sendEmail: vi.fn(),
    resolve: vi.fn(),
    dismiss: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardTransactionsQuery: () => ({
            transactions: mocks.transactions,
            isLoading: false,
        }),
    }
})

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({
        resolve: mocks.resolve,
        dismiss: mocks.dismiss,
    }),
}))

vi.mock('@hooks/useSendEmail', () => ({
    useSendEmail: () => ({ sendEmail: mocks.sendEmail }),
}))

// Interpolation-aware t so the templated email bodies can be asserted.
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

import { useReportTransactionsSheet } from '../useReportTransactionsSheet'

const tx = (id: string, transactionId: string): CardTransaction =>
    ({ id, transactionId }) as unknown as CardTransaction

describe('useReportTransactionsSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.transactions = [
            tx('row_1', 'auth_1001'),
            tx('row_2', 'auth_1002'),
            tx('row_3', ''),
        ]
    })

    it('toggles selection and gates the report button on it', () => {
        const { result } = renderHook(() => useReportTransactionsSheet())
        expect(result.current.canReport).toBe(false)

        act(() => {
            result.current.onToggle('row_1')
        })
        expect(result.current.isSelected('row_1')).toBe(true)
        expect(result.current.canReport).toBe(true)
        // Selecting is tracked...
        expect(mockTrackEvent).toHaveBeenCalledTimes(1)
        expect(mockTrackEvent).toHaveBeenCalledWith(CardEvent.ReportSusReportTx)

        act(() => {
            result.current.onToggle('row_1')
        })
        expect(result.current.isSelected('row_1')).toBe(false)
        expect(result.current.canReport).toBe(false)
        // ...deselecting is not.
        expect(mockTrackEvent).toHaveBeenCalledTimes(1)
    })

    it('emails the processor ids of the selected transactions and resolves', () => {
        const { result } = renderHook(() => useReportTransactionsSheet())

        act(() => {
            result.current.onToggle('row_1')
        })
        act(() => {
            // Empty processor id falls back to the row id.
            result.current.onToggle('row_3')
        })
        act(() => {
            result.current.onReport()
        })

        expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
        const args = mocks.sendEmail.mock.calls[0][0]
        expect(args.to).toBe('support@baanx.com')
        expect(args.body).toContain('auth_1001')
        expect(args.body).toContain('row_3')
        expect(args.body).not.toContain('auth_1002')
        expect(mocks.resolve).toHaveBeenCalledWith('reported')
        expect(mockTrackEvent).toHaveBeenCalledWith(
            CardEvent.ReportSusCreateTicket,
        )
    })

    it('does nothing on report with nothing selected', () => {
        const { result } = renderHook(() => useReportTransactionsSheet())

        act(() => {
            result.current.onReport()
        })

        expect(mocks.sendEmail).not.toHaveBeenCalled()
        expect(mocks.resolve).not.toHaveBeenCalled()
        expect(mockTrackEvent).not.toHaveBeenCalledWith(
            CardEvent.ReportSusCreateTicket,
        )
    })
})
