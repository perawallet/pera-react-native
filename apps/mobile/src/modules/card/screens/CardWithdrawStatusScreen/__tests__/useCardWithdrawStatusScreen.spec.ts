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

import { renderHook, act, waitFor } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'

const mocks = vi.hoisted(() => ({
    pending: null as unknown,
    isReady: false,
    complete: vi.fn(),
    cancel: vi.fn(),
    showError: vi.fn(),
    successToast: vi.fn(),
    goBack: vi.fn(),
    isFocused: true,
}))
const owner = { address: 'OWNER', name: 'Main Account' }

vi.mock('../../../hooks', () => ({
    useCardOwnerAccount: () => owner,
    useCardWithdraw: () => ({
        pending: mocks.pending,
        pendingAmount: new Decimal('25'),
        secondsUntilReady: mocks.isReady ? 0 : 12,
        isReady: mocks.isReady,
        isPendingLoading: false,
        request: vi.fn(),
        complete: mocks.complete,
        cancel: mocks.cancel,
        isRequesting: false,
        isCompleting: false,
        isCancelling: false,
    }),
    useCardErrorToast: () => mocks.showError,
}))
vi.mock('@react-navigation/native', async () => ({
    ...(await vi.importActual<object>('@react-navigation/native')),
    useNavigation: () => ({
        goBack: mocks.goBack,
        isFocused: () => mocks.isFocused,
    }),
}))
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        successToast: mocks.successToast,
        errorToast: vi.fn(),
        infoToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

import { useCardWithdrawStatusScreen } from '../useCardWithdrawStatusScreen'

describe('useCardWithdrawStatusScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.pending = { amount: 25_000_000n }
        mocks.isReady = false
        mocks.isFocused = true
        mocks.complete.mockResolvedValue(undefined)
        mocks.cancel.mockResolvedValue(undefined)
        mocks.showError.mockResolvedValue(undefined)
    })

    it('shows the open request, its destination and the countdown', () => {
        const { result } = renderHook(() => useCardWithdrawStatusScreen())

        expect(result.current.hasPending).toBe(true)
        expect(result.current.amountDisplay).toBe('25.00')
        expect(result.current.destinationAccount).toEqual(owner)
        expect(result.current.isReady).toBe(false)
        expect(result.current.secondsUntilReady).toBe(12)
    })

    it('reports nothing pending once the request is gone', () => {
        mocks.pending = null
        const { result } = renderHook(() => useCardWithdrawStatusScreen())

        expect(result.current.hasPending).toBe(false)
    })

    it('completes the request, toasts the amount and leaves', async () => {
        mocks.isReady = true
        const { result } = renderHook(() => useCardWithdrawStatusScreen())

        act(() => result.current.onComplete())

        await waitFor(() => expect(mocks.goBack).toHaveBeenCalled())
        expect(mocks.complete).toHaveBeenCalled()
        expect(mocks.successToast).toHaveBeenCalledWith(
            'peraCard.withdraw.completed_title',
            'peraCard.withdraw.completed_body',
        )
        expect(mocks.showError).not.toHaveBeenCalled()
    })

    it('cancels the request, toasts and leaves', async () => {
        const { result } = renderHook(() => useCardWithdrawStatusScreen())

        act(() => result.current.onCancel())

        await waitFor(() => expect(mocks.goBack).toHaveBeenCalled())
        expect(mocks.cancel).toHaveBeenCalled()
        expect(mocks.successToast).toHaveBeenCalledWith(
            'peraCard.withdraw.cancelled_title',
            'peraCard.withdraw.cancelled_body',
        )
    })

    it('surfaces a failed step and stays, but stays silent on a declined review', async () => {
        mocks.complete.mockRejectedValueOnce(new Error('algod said no'))
        const { result } = renderHook(() => useCardWithdrawStatusScreen())

        act(() => result.current.onComplete())
        await waitFor(() => expect(mocks.showError).toHaveBeenCalledTimes(1))
        expect(mocks.goBack).not.toHaveBeenCalled()

        mocks.cancel.mockRejectedValueOnce(new UserRejectedSigningError())
        act(() => result.current.onCancel())
        await waitFor(() => expect(mocks.cancel).toHaveBeenCalled())
        expect(mocks.showError).toHaveBeenCalledTimes(1)
        expect(mocks.successToast).not.toHaveBeenCalled()
    })

    it('does not navigate when the screen lost focus meanwhile', async () => {
        mocks.isReady = true
        mocks.isFocused = false
        const { result } = renderHook(() => useCardWithdrawStatusScreen())

        act(() => result.current.onComplete())

        await waitFor(() => expect(mocks.successToast).toHaveBeenCalled())
        expect(mocks.goBack).not.toHaveBeenCalled()
    })
})
