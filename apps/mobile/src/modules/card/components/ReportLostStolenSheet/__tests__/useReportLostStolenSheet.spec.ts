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
import { act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    status: 'ACTIVE' as string,
    panLast4: '4242' as string | null,
    freezeMutateAsync: vi.fn(),
    freezePending: false,
    sendEmail: vi.fn(),
    resolve: vi.fn(),
    dismiss: vi.fn(),
    errorToast: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardStatusQuery: () => ({ data: { status: mocks.status } }),
        useCardStore: (
            selector: (state: { lastKnownPanLast4: string | null }) => unknown,
        ) => selector({ lastKnownPanLast4: mocks.panLast4 }),
        useFreezeCardMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mocks.freezeMutateAsync,
            isPending: mocks.freezePending,
            isError: false,
            isSuccess: false,
            isPaused: false,
            error: null,
            data: null,
            reset: vi.fn(),
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

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        errorToast: mocks.errorToast,
        infoToast: vi.fn(),
        successToast: vi.fn(),
        showToast: vi.fn(),
    }),
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

import { useReportLostStolenSheet } from '../useReportLostStolenSheet'

describe('useReportLostStolenSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.status = 'ACTIVE'
        mocks.panLast4 = '4242'
        mocks.freezePending = false
        mocks.freezeMutateAsync.mockResolvedValue(undefined)
    })

    it('freezes the card, then opens the support email and resolves', async () => {
        const { result } = renderHook(() => useReportLostStolenSheet())

        act(() => {
            result.current.onConfirm()
        })

        await waitFor(() =>
            expect(mocks.resolve).toHaveBeenCalledWith('frozen'),
        )
        expect(mocks.freezeMutateAsync).toHaveBeenCalledTimes(1)
        expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
        const args = mocks.sendEmail.mock.calls[0][0]
        expect(args.to).toBe('support@baanx.com')
        // The body carries the card's last 4 for support to identify it.
        expect(args.body).toContain('4242')
        // The freeze must land before the composer opens.
        expect(
            mocks.freezeMutateAsync.mock.invocationCallOrder[0],
        ).toBeLessThan(mocks.sendEmail.mock.invocationCallOrder[0])
    })

    it('skips the freeze but still emails when the card is already frozen', async () => {
        mocks.status = 'FROZEN'
        const { result } = renderHook(() => useReportLostStolenSheet())

        act(() => {
            result.current.onConfirm()
        })

        await waitFor(() => expect(mocks.sendEmail).toHaveBeenCalled())
        expect(mocks.freezeMutateAsync).not.toHaveBeenCalled()
        expect(mocks.resolve).toHaveBeenCalledWith('skipped')
    })

    it('keeps the sheet open and skips the email when the freeze fails', async () => {
        mocks.freezeMutateAsync.mockRejectedValue(new Error('baanx down'))
        const { result } = renderHook(() => useReportLostStolenSheet())

        act(() => {
            result.current.onConfirm()
        })

        await waitFor(() => expect(mocks.errorToast).toHaveBeenCalled())
        expect(mocks.sendEmail).not.toHaveBeenCalled()
        expect(mocks.resolve).not.toHaveBeenCalled()
        expect(mocks.dismiss).not.toHaveBeenCalled()
    })

    it('does not start a second freeze while one is pending', async () => {
        mocks.freezePending = true
        const { result } = renderHook(() => useReportLostStolenSheet())

        act(() => {
            result.current.onConfirm()
        })

        await act(async () => {})
        expect(mocks.freezeMutateAsync).not.toHaveBeenCalled()
        expect(mocks.sendEmail).not.toHaveBeenCalled()
    })
})
