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
import { act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    request: vi.fn(),
    successToast: vi.fn(),
    status: 'ACTIVE' as string,
}))

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardStatusQuery: () => ({ data: { status: mocks.status } }),
    }
})

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.request }),
    // Imported by the sheet components pulled in below, but never invoked
    // because those sheets are only built as elements, not rendered.
    useBottomSheetResult: () => ({ resolve: vi.fn(), dismiss: vi.fn() }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        successToast: mocks.successToast,
        errorToast: vi.fn(),
        infoToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { BeforeWeContinueSheet } from '../../components/BeforeWeContinueSheet'
import { ReportSuspiciousActivitySheet } from '../../components/ReportSuspiciousActivitySheet'
import { useReportSuspiciousFlow } from '../useReportSuspiciousFlow'

describe('useReportSuspiciousFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.status = 'ACTIVE'
    })

    it('freezes, toasts, then opens all three sheets in order', async () => {
        mocks.request
            .mockResolvedValueOnce('frozen')
            .mockResolvedValueOnce('continue')
            .mockResolvedValueOnce(undefined)

        const { result } = renderHook(() => useReportSuspiciousFlow())

        act(() => {
            result.current.start()
        })

        await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(3))
        expect(mocks.successToast).toHaveBeenCalledTimes(1)
        expect(mocks.request.mock.calls[0][0].contents.type).toBe(
            ReportSuspiciousActivitySheet,
        )
        // The final step is the modal-sized transaction selection sheet.
        expect(mocks.request.mock.calls[2][0].options.size).toBe('modal')
    })

    it('skips the freeze sheet and starts at "before we continue" when already frozen', async () => {
        mocks.status = 'FROZEN'
        mocks.request
            .mockResolvedValueOnce('continue')
            .mockResolvedValueOnce(undefined)

        const { result } = renderHook(() => useReportSuspiciousFlow())

        act(() => {
            result.current.start()
        })

        await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2))
        expect(mocks.successToast).not.toHaveBeenCalled()
        expect(mocks.request.mock.calls[0][0].contents.type).toBe(
            BeforeWeContinueSheet,
        )
        expect(mocks.request.mock.calls[1][0].options.size).toBe('modal')
    })

    it('skips the freeze sheet for a blocked card (never freezes it)', async () => {
        mocks.status = 'BLOCKED'
        mocks.request
            .mockResolvedValueOnce('continue')
            .mockResolvedValueOnce(undefined)

        const { result } = renderHook(() => useReportSuspiciousFlow())

        act(() => {
            result.current.start()
        })

        await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2))
        expect(mocks.successToast).not.toHaveBeenCalled()
        // Straight to the report — a blocked card is never pushed through a
        // freeze it can't take.
        expect(mocks.request.mock.calls[0][0].contents.type).toBe(
            BeforeWeContinueSheet,
        )
        expect(mocks.request.mock.calls[1][0].options.size).toBe('modal')
    })

    it('abandons the flow when the first sheet is dismissed', async () => {
        mocks.request.mockResolvedValueOnce(undefined)

        const { result } = renderHook(() => useReportSuspiciousFlow())

        act(() => {
            result.current.start()
        })

        await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1))
        await act(async () => {})
        expect(mocks.request).toHaveBeenCalledTimes(1)
        expect(mocks.successToast).not.toHaveBeenCalled()
    })

    it('stops before the transaction sheet when "before we continue" is cancelled', async () => {
        mocks.request
            .mockResolvedValueOnce('frozen')
            .mockResolvedValueOnce(undefined)

        const { result } = renderHook(() => useReportSuspiciousFlow())

        act(() => {
            result.current.start()
        })

        await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2))
        expect(mocks.successToast).toHaveBeenCalledTimes(1)
        await act(async () => {})
        expect(mocks.request).toHaveBeenCalledTimes(2)
    })
})
