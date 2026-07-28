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

const mocks = vi.hoisted(() => ({
    unfreezeMutateAsync: vi.fn(),
    unfreezePending: false,
    resolve: vi.fn(),
    dismiss: vi.fn(),
    errorToast: vi.fn(),
}))

const mutationResult = (
    mutateAsync: ReturnType<typeof vi.fn>,
    isPending = false,
) => ({
    mutate: vi.fn(),
    mutateAsync,
    isPending,
    isError: false,
    isSuccess: false,
    isPaused: false,
    error: null,
    data: null,
    reset: vi.fn(),
})

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useUnfreezeCardMutation: () =>
            mutationResult(mocks.unfreezeMutateAsync, mocks.unfreezePending),
        // `vi.importActual` doesn't surface this re-export under vitest, so the
        // error path's `useCardErrorToast` can't resolve it — provide it
        // explicitly so the failure-toast assertion exercises the real handler.
        getCardApiError: async (error: unknown) => ({
            message: error instanceof Error ? error.message : undefined,
        }),
    }
})

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({
        resolve: mocks.resolve,
        dismiss: mocks.dismiss,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        infoToast: vi.fn(),
        errorToast: mocks.errorToast,
        showToast: vi.fn(),
        successToast: vi.fn(),
    }),
}))

import { useUnfreezeCardConfirmationSheet } from '../useUnfreezeCardConfirmationSheet'

describe('useUnfreezeCardConfirmationSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.unfreezePending = false
    })

    it('unfreezes then closes the sheet on confirm', async () => {
        mocks.unfreezeMutateAsync.mockResolvedValue(undefined)

        const { result } = renderHook(() => useUnfreezeCardConfirmationSheet())
        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.unfreezeMutateAsync).toHaveBeenCalledTimes(1)
        expect(mocks.resolve).toHaveBeenCalledWith('confirm')
    })

    it('keeps the sheet open and toasts when unfreezing fails', async () => {
        mocks.unfreezeMutateAsync.mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() => useUnfreezeCardConfirmationSheet())
        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.errorToast).toHaveBeenCalledTimes(1)
        expect(mocks.resolve).not.toHaveBeenCalled()
    })

    it('does not start a second unfreeze while one is pending', async () => {
        mocks.unfreezePending = true

        const { result } = renderHook(() => useUnfreezeCardConfirmationSheet())
        expect(result.current.isUnfreezing).toBe(true)

        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.unfreezeMutateAsync).not.toHaveBeenCalled()
    })

    it('closes the sheet on close', () => {
        const { result } = renderHook(() => useUnfreezeCardConfirmationSheet())

        act(() => {
            result.current.onClose()
        })

        expect(mocks.dismiss).toHaveBeenCalledTimes(1)
    })
})
