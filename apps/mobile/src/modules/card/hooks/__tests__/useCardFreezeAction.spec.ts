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
    freezeMutateAsync: vi.fn(),
    freezePending: false,
    resolve: vi.fn(),
    dismiss: vi.fn(),
    errorToast: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardStatusQuery: () => ({ data: { status: mocks.status } }),
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

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        errorToast: mocks.errorToast,
        infoToast: vi.fn(),
        successToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

import { useCardFreezeAction } from '../useCardFreezeAction'

describe('useCardFreezeAction', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.status = 'ACTIVE'
        mocks.freezePending = false
        mocks.freezeMutateAsync.mockResolvedValue(undefined)
    })

    it('freezes an active card and resolves "frozen"', async () => {
        const { result } = renderHook(() => useCardFreezeAction())

        act(() => {
            result.current.onConfirm()
        })

        await waitFor(() =>
            expect(mocks.resolve).toHaveBeenCalledWith('frozen'),
        )
        expect(mocks.freezeMutateAsync).toHaveBeenCalledTimes(1)
    })

    it('skips the freeze when already frozen and resolves "skipped"', async () => {
        mocks.status = 'FROZEN'
        const { result } = renderHook(() => useCardFreezeAction())

        act(() => {
            result.current.onConfirm()
        })

        await waitFor(() =>
            expect(mocks.resolve).toHaveBeenCalledWith('skipped'),
        )
        expect(mocks.freezeMutateAsync).not.toHaveBeenCalled()
    })

    it('never freezes a blocked card and resolves "skipped"', async () => {
        mocks.status = 'BLOCKED'
        const { result } = renderHook(() => useCardFreezeAction())

        act(() => {
            result.current.onConfirm()
        })

        await waitFor(() =>
            expect(mocks.resolve).toHaveBeenCalledWith('skipped'),
        )
        expect(mocks.freezeMutateAsync).not.toHaveBeenCalled()
    })

    it('runs onFrozen after freezing and before resolving', async () => {
        const onFrozen = vi.fn()
        const { result } = renderHook(() => useCardFreezeAction({ onFrozen }))

        act(() => {
            result.current.onConfirm()
        })

        await waitFor(() => expect(onFrozen).toHaveBeenCalledTimes(1))
        // Freeze must land before the side effect, which runs before resolve.
        expect(
            mocks.freezeMutateAsync.mock.invocationCallOrder[0],
        ).toBeLessThan(onFrozen.mock.invocationCallOrder[0])
        expect(onFrozen.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.resolve.mock.invocationCallOrder[0],
        )
    })

    it('runs onFrozen even when the freeze is skipped', async () => {
        mocks.status = 'FROZEN'
        const onFrozen = vi.fn()
        const { result } = renderHook(() => useCardFreezeAction({ onFrozen }))

        act(() => {
            result.current.onConfirm()
        })

        await waitFor(() => expect(onFrozen).toHaveBeenCalledTimes(1))
        expect(mocks.freezeMutateAsync).not.toHaveBeenCalled()
        expect(mocks.resolve).toHaveBeenCalledWith('skipped')
    })

    it('keeps the sheet open and skips onFrozen when the freeze fails', async () => {
        mocks.freezeMutateAsync.mockRejectedValue(new Error('baanx down'))
        const onFrozen = vi.fn()
        const { result } = renderHook(() => useCardFreezeAction({ onFrozen }))

        act(() => {
            result.current.onConfirm()
        })

        await waitFor(() => expect(mocks.errorToast).toHaveBeenCalled())
        expect(onFrozen).not.toHaveBeenCalled()
        expect(mocks.resolve).not.toHaveBeenCalled()
        expect(mocks.dismiss).not.toHaveBeenCalled()
    })

    it('does not start a second freeze while one is pending', async () => {
        mocks.freezePending = true
        const { result } = renderHook(() => useCardFreezeAction())

        act(() => {
            result.current.onConfirm()
        })

        await act(async () => {})
        expect(mocks.freezeMutateAsync).not.toHaveBeenCalled()
        expect(mocks.resolve).not.toHaveBeenCalled()
    })
})
