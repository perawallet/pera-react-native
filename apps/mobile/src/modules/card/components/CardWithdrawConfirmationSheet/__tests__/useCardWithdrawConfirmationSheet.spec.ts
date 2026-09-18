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
import { Decimal } from 'decimal.js'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'

const mocks = vi.hoisted(() => ({
    request: vi.fn(),
    isRequesting: false,
    pending: null as unknown,
    cardBalance: '150',
    owner: null as unknown,
    resolve: vi.fn(),
    dismiss: vi.fn(),
    showError: vi.fn(),
}))

const owner = { address: 'OWNER', name: 'Main Account' }

vi.mock('../../../hooks', () => ({
    useCardWithdraw: () => ({
        request: mocks.request,
        isRequesting: mocks.isRequesting,
        pending: mocks.pending,
    }),
    useCardEscrowBalance: () => ({
        balance: new Decimal(mocks.cardBalance),
        isLoading: false,
    }),
    useCardOwnerAccount: () => mocks.owner,
    useCardErrorToast: () => mocks.showError,
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({
        resolve: mocks.resolve,
        dismiss: mocks.dismiss,
    }),
}))

import { useCardWithdrawConfirmationSheet } from '../useCardWithdrawConfirmationSheet'

describe('useCardWithdrawConfirmationSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isRequesting = false
        mocks.pending = null
        mocks.cardBalance = '150'
        mocks.owner = owner
        mocks.request.mockResolvedValue(undefined)
    })

    it('requests the withdrawal and resolves the sheet on confirm', async () => {
        const { result } = renderHook(() =>
            useCardWithdrawConfirmationSheet({ amount: new Decimal('25.5') }),
        )
        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.request).toHaveBeenCalledWith(new Decimal('25.5'))
        expect(mocks.resolve).toHaveBeenCalledWith('confirm')
    })

    it('formats the amount for display with two decimals', () => {
        const { result } = renderHook(() =>
            useCardWithdrawConfirmationSheet({ amount: new Decimal('25.5') }),
        )

        expect(result.current.amountDisplay).toBe('25.50')
        expect(result.current.destinationAccount).toBe(owner)
    })

    it('keeps the sheet open and toasts when the request fails', async () => {
        mocks.request.mockRejectedValue(new Error('boom'))
        const { result } = renderHook(() =>
            useCardWithdrawConfirmationSheet({ amount: new Decimal('1') }),
        )
        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.showError).toHaveBeenCalledTimes(1)
        expect(mocks.resolve).not.toHaveBeenCalled()
    })

    // Backing out of the signing review is a user action, not a failure.
    it('stays silent when the user rejects the signing review', async () => {
        mocks.request.mockRejectedValue(new UserRejectedSigningError())
        const { result } = renderHook(() =>
            useCardWithdrawConfirmationSheet({ amount: new Decimal('1') }),
        )
        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.showError).not.toHaveBeenCalled()
        expect(mocks.resolve).not.toHaveBeenCalled()
    })

    it.each([
        ['the owner is gone', () => (mocks.owner = null), '1'],
        ['a request is already pending', () => (mocks.pending = {}), '1'],
        [
            'the amount exceeds the card balance',
            () => (mocks.cardBalance = '0.5'),
            '1',
        ],
    ])(
        're-checks before submitting and toasts when %s',
        async (_, arrange, amount) => {
            arrange()
            const { result } = renderHook(() =>
                useCardWithdrawConfirmationSheet({
                    amount: new Decimal(amount),
                }),
            )
            await act(async () => {
                result.current.onConfirm()
            })

            expect(mocks.request).not.toHaveBeenCalled()
            expect(mocks.showError).toHaveBeenCalledWith(null)
        },
    )

    it('ignores a second tap while the first request is in flight', async () => {
        mocks.isRequesting = true
        const { result } = renderHook(() =>
            useCardWithdrawConfirmationSheet({ amount: new Decimal('1') }),
        )
        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.request).not.toHaveBeenCalled()
        expect(result.current.isWithdrawing).toBe(true)
    })
})
