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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSwapConfirmationActions } from '../useSwapConfirmationActions'
import type { SwapExecutionOutcome } from '../../../hooks/useSwapExecution'

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
            useSwapConfirmationActions({ quoteIdStr: 'quote-1' }),
        )

        await act(async () => {
            await result.current.handleSlideConfirm()
        })

        expect(mockExecute).toHaveBeenCalledWith('quote-1')
        expect(mockSchedule).toHaveBeenCalled()
        expect(mockResolve).toHaveBeenCalledWith({ kind: 'confirm' })
    })

    it('resolves with cancelled when execute reports user rejection', async () => {
        mockExecute.mockResolvedValueOnce({ kind: 'cancelled' })

        const { result } = renderHook(() =>
            useSwapConfirmationActions({ quoteIdStr: 'quote-2' }),
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
            useSwapConfirmationActions({ quoteIdStr: 'quote-3' }),
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
            useSwapConfirmationActions({ quoteIdStr: undefined }),
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
            useSwapConfirmationActions({ quoteIdStr: 'quote-4' }),
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

    it('handleClose dismisses when not processing', () => {
        const { result } = renderHook(() =>
            useSwapConfirmationActions({ quoteIdStr: 'quote-5' }),
        )

        act(() => {
            result.current.handleClose(false)
        })

        expect(mockFlush).toHaveBeenCalledTimes(1)
        expect(mockDismiss).toHaveBeenCalledTimes(1)
    })

    it('handleClose is a no-op while processing', () => {
        const { result } = renderHook(() =>
            useSwapConfirmationActions({ quoteIdStr: 'quote-6' }),
        )

        act(() => {
            result.current.handleClose(true)
        })

        expect(mockFlush).not.toHaveBeenCalled()
        expect(mockDismiss).not.toHaveBeenCalled()
    })

    it('resets execution state on mount', () => {
        renderHook(() => useSwapConfirmationActions({ quoteIdStr: 'quote-7' }))

        expect(mockReset).toHaveBeenCalledTimes(1)
    })
})
