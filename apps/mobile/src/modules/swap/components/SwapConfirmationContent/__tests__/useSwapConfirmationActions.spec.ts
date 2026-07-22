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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSwapConfirmationActions } from '../useSwapConfirmationActions'
import type { SwapExecutionOutcome } from '../../../hooks/useSwapExecution'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'

const makeQuote = (quoteIdStr?: string): SwapQuote =>
    ({
        quoteIdStr,
        assetIn: {
            assetId: '0',
            unitName: 'ALGO',
            verificationTier: 'trusted',
        },
        assetOut: {
            assetId: '31566704',
            unitName: 'USDC',
            verificationTier: 'trusted',
        },
    }) as SwapQuote

const mockResolve = vi.fn()
const mockDismiss = vi.fn()
const mockExecute =
    vi.fn<(quoteIdStr: string) => Promise<SwapExecutionOutcome>>()
const mockReset = vi.fn()
const mockSchedule = vi.fn((callback: () => void, _delayMs: number) => {
    callback()
})
const mockFlush = vi.fn()
const mockCancel = vi.fn()
const mockExecutionCancel = vi.fn()

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({
        resolve: mockResolve,
        dismiss: mockDismiss,
    }),
}))

vi.mock('@hooks/useRunAfterDelay', () => ({
    useRunAfterDelay: () => ({
        schedule: mockSchedule,
        flush: mockFlush,
        cancel: mockCancel,
    }),
}))

vi.mock('../../../hooks/useSwapExecution', () => ({
    useSwapExecution: () => ({
        execute: mockExecute,
        cancel: mockExecutionCancel,
        reset: mockReset,
        status: 'idle',
        error: null,
        txIds: [],
    }),
}))

describe('useSwapConfirmationActions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('resolves with confirm when execute succeeds', async () => {
        mockExecute.mockResolvedValueOnce({ kind: 'success' })

        const { result } = renderHook(() =>
            useSwapConfirmationActions({ quote: makeQuote('quote-1') }),
        )

        await act(async () => {
            await result.current.handleSlideConfirm()
        })

        expect(mockExecute).toHaveBeenCalledWith(
            expect.objectContaining({ quoteIdStr: 'quote-1' }),
        )
        expect(mockSchedule).toHaveBeenCalled()
        expect(mockResolve).toHaveBeenCalledWith({ kind: 'confirm' })
    })

    it('resolves with cancelled when execute reports user rejection', async () => {
        mockExecute.mockResolvedValueOnce({ kind: 'cancelled' })

        const { result } = renderHook(() =>
            useSwapConfirmationActions({ quote: makeQuote('quote-2') }),
        )

        await act(async () => {
            await result.current.handleSlideConfirm()
        })

        expect(mockResolve).toHaveBeenCalledWith({ kind: 'cancelled' })
        expect(mockSchedule).not.toHaveBeenCalled()
    })

    it('resolves with error message when execute fails', async () => {
        mockExecute.mockResolvedValueOnce({
            kind: 'error',
            phase: 'submission',
            message: 'Pool drained',
        })

        const { result } = renderHook(() =>
            useSwapConfirmationActions({ quote: makeQuote('quote-3') }),
        )

        await act(async () => {
            await result.current.handleSlideConfirm()
        })

        expect(mockResolve).toHaveBeenCalledWith({
            kind: 'error',
            message: 'Pool drained',
        })
        expect(mockSchedule).not.toHaveBeenCalled()
    })

    it('does nothing when quoteIdStr is missing', async () => {
        const { result } = renderHook(() =>
            useSwapConfirmationActions({ quote: makeQuote() }),
        )

        await act(async () => {
            await result.current.handleSlideConfirm()
        })

        expect(mockExecute).not.toHaveBeenCalled()
        expect(mockResolve).not.toHaveBeenCalled()
    })

    it('in-flight guard prevents a second concurrent execute', async () => {
        // Hold the first execute promise open so the second call lands while
        // the first is still in flight.
        let releaseFirst: (value: SwapExecutionOutcome) => void = () => {}
        mockExecute.mockImplementationOnce(
            () =>
                new Promise<SwapExecutionOutcome>(resolve => {
                    releaseFirst = resolve
                }),
        )

        const { result } = renderHook(() =>
            useSwapConfirmationActions({ quote: makeQuote('quote-4') }),
        )

        await act(async () => {
            void result.current.handleSlideConfirm()
            // Second call must be a no-op while the first is in flight.
            await result.current.handleSlideConfirm()
        })

        expect(mockExecute).toHaveBeenCalledTimes(1)

        await act(async () => {
            releaseFirst({ kind: 'success' })
        })

        expect(mockResolve).toHaveBeenCalledTimes(1)
        expect(mockResolve).toHaveBeenCalledWith({ kind: 'confirm' })
    })

    it('resolves with stale-quote when the quote outlived its TTL', async () => {
        mockExecute.mockResolvedValueOnce({ kind: 'stale-quote' })

        const { result } = renderHook(() =>
            useSwapConfirmationActions({ quote: makeQuote('quote-8') }),
        )

        await act(async () => {
            await result.current.handleSlideConfirm()
        })

        expect(mockResolve).toHaveBeenCalledWith({ kind: 'stale-quote' })
        expect(mockSchedule).not.toHaveBeenCalled()
    })

    it('handleClose dismisses when idle', () => {
        const { result } = renderHook(() =>
            useSwapConfirmationActions({ quote: makeQuote('quote-5') }),
        )

        act(() => {
            result.current.handleClose(false, false)
        })

        expect(mockFlush).toHaveBeenCalledTimes(1)
        expect(mockDismiss).toHaveBeenCalledTimes(1)
    })

    it('handleClose cancels the in-flight execution while preparing instead of trapping', () => {
        const { result } = renderHook(() =>
            useSwapConfirmationActions({ quote: makeQuote('quote-6') }),
        )

        act(() => {
            result.current.handleClose(false, true)
        })

        // The execute() in flight observes the cancel and resolves the
        // sheet as cancelled — no direct dismiss from here.
        expect(mockExecutionCancel).toHaveBeenCalledTimes(1)
        expect(mockDismiss).not.toHaveBeenCalled()
    })

    it('handleClose stays blocked once the swap has committed (signing onward)', () => {
        const { result } = renderHook(() =>
            useSwapConfirmationActions({ quote: makeQuote('quote-6') }),
        )

        act(() => {
            result.current.handleClose(true, false)
        })

        expect(mockExecutionCancel).not.toHaveBeenCalled()
        expect(mockFlush).not.toHaveBeenCalled()
        expect(mockDismiss).not.toHaveBeenCalled()
    })

    it('resets execution state on mount', () => {
        renderHook(() =>
            useSwapConfirmationActions({ quote: makeQuote('quote-7') }),
        )

        expect(mockReset).toHaveBeenCalledTimes(1)
    })
})
