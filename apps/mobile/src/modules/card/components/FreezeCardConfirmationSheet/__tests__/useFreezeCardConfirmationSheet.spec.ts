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
import { act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    freezeMutateAsync: vi.fn(),
    freezePending: false,
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
    error: null,
    data: null,
    reset: vi.fn(),
})

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useFreezeCardMutation: () =>
            mutationResult(mocks.freezeMutateAsync, mocks.freezePending),
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

import { useFreezeCardConfirmationSheet } from '../useFreezeCardConfirmationSheet'

describe('useFreezeCardConfirmationSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.freezePending = false
    })

    it('freezes then closes the sheet on confirm', async () => {
        mocks.freezeMutateAsync.mockResolvedValue(undefined)

        const { result } = renderHook(() => useFreezeCardConfirmationSheet())
        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.freezeMutateAsync).toHaveBeenCalledTimes(1)
        expect(mocks.resolve).toHaveBeenCalledWith('confirm')
    })

    it('keeps the sheet open and toasts when freezing fails', async () => {
        mocks.freezeMutateAsync.mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() => useFreezeCardConfirmationSheet())
        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.errorToast).toHaveBeenCalledTimes(1)
        expect(mocks.resolve).not.toHaveBeenCalled()
    })

    it('does not start a second freeze while one is pending', async () => {
        mocks.freezePending = true

        const { result } = renderHook(() => useFreezeCardConfirmationSheet())
        expect(result.current.isFreezing).toBe(true)

        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.freezeMutateAsync).not.toHaveBeenCalled()
    })

    it('closes the sheet on close', () => {
        const { result } = renderHook(() => useFreezeCardConfirmationSheet())

        act(() => {
            result.current.onClose()
        })

        expect(mocks.dismiss).toHaveBeenCalledTimes(1)
    })
})
