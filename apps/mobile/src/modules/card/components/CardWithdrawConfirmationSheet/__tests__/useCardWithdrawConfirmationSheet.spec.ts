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

const mocks = vi.hoisted(() => ({
    withdrawMutateAsync: vi.fn(),
    withdrawPending: false,
    usdcWallet: null as unknown,
    selectedAccount: null as unknown,
    resolve: vi.fn(),
    dismiss: vi.fn(),
    errorToast: vi.fn(),
}))

const usdcWallet = {
    id: 'wallet_usdc',
    balance: new Decimal('150'),
    currency: 'usdc',
    address: 'BAANX_ADDR',
    addressMemo: null,
    addressId: 'addr_1',
    type: 'INTERNAL',
}

const account = { address: 'ALGO_RECIPIENT', name: 'Main Account' }

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useWithdrawFromCardMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mocks.withdrawMutateAsync,
            isPending: mocks.withdrawPending,
            isError: false,
            isSuccess: false,
            isPaused: false,
            error: null,
            data: null,
            reset: vi.fn(),
        }),
        useCardInternalWalletsQuery: () => ({
            usdcWallet: mocks.usdcWallet,
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
        }),
    }
})

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useSelectedAccount: () => mocks.selectedAccount,
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

import { useCardWithdrawConfirmationSheet } from '../useCardWithdrawConfirmationSheet'

describe('useCardWithdrawConfirmationSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.withdrawPending = false
        mocks.usdcWallet = usdcWallet
        mocks.selectedAccount = account
    })

    it('withdraws to the destination account and resolves the sheet on confirm', async () => {
        mocks.withdrawMutateAsync.mockResolvedValue(undefined)

        const { result } = renderHook(() =>
            useCardWithdrawConfirmationSheet({ amount: new Decimal('25.5') }),
        )
        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.withdrawMutateAsync).toHaveBeenCalledWith({
            amount: new Decimal('25.5'),
            recipientAddress: 'ALGO_RECIPIENT',
            wallet: usdcWallet,
        })
        expect(mocks.resolve).toHaveBeenCalledWith('confirm')
    })

    it('formats the amount for display with two decimals', () => {
        const { result } = renderHook(() =>
            useCardWithdrawConfirmationSheet({ amount: new Decimal('25.5') }),
        )

        expect(result.current.amountDisplay).toBe('25.50')
    })

    it('keeps the sheet open and toasts when the withdrawal fails', async () => {
        mocks.withdrawMutateAsync.mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() =>
            useCardWithdrawConfirmationSheet({ amount: new Decimal('1') }),
        )
        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.errorToast).toHaveBeenCalledTimes(1)
        expect(mocks.resolve).not.toHaveBeenCalled()
    })

    it('does not start a second withdrawal while one is pending', async () => {
        mocks.withdrawPending = true

        const { result } = renderHook(() =>
            useCardWithdrawConfirmationSheet({ amount: new Decimal('1') }),
        )
        expect(result.current.isWithdrawing).toBe(true)

        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.withdrawMutateAsync).not.toHaveBeenCalled()
    })

    it('toasts instead of withdrawing when the amount exceeds the card balance', async () => {
        mocks.usdcWallet = { ...usdcWallet, balance: new Decimal('10') }

        const { result } = renderHook(() =>
            useCardWithdrawConfirmationSheet({ amount: new Decimal('25.5') }),
        )
        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.withdrawMutateAsync).not.toHaveBeenCalled()
        expect(mocks.errorToast).toHaveBeenCalledTimes(1)
        expect(mocks.resolve).not.toHaveBeenCalled()
    })

    it('toasts instead of withdrawing when the amount is zero', async () => {
        const { result } = renderHook(() =>
            useCardWithdrawConfirmationSheet({ amount: new Decimal(0) }),
        )
        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.withdrawMutateAsync).not.toHaveBeenCalled()
        expect(mocks.errorToast).toHaveBeenCalledTimes(1)
        expect(mocks.resolve).not.toHaveBeenCalled()
    })

    it('toasts instead of withdrawing when the USDC wallet is missing', async () => {
        mocks.usdcWallet = null

        const { result } = renderHook(() =>
            useCardWithdrawConfirmationSheet({ amount: new Decimal('1') }),
        )
        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.withdrawMutateAsync).not.toHaveBeenCalled()
        expect(mocks.errorToast).toHaveBeenCalledTimes(1)
    })

    it('toasts instead of withdrawing when no destination account exists', async () => {
        mocks.selectedAccount = null

        const { result } = renderHook(() =>
            useCardWithdrawConfirmationSheet({ amount: new Decimal('1') }),
        )
        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.withdrawMutateAsync).not.toHaveBeenCalled()
        expect(mocks.errorToast).toHaveBeenCalledTimes(1)
    })

    it('dismisses the sheet on close', () => {
        const { result } = renderHook(() =>
            useCardWithdrawConfirmationSheet({ amount: new Decimal('1') }),
        )

        result.current.onClose()

        expect(mocks.dismiss).toHaveBeenCalledTimes(1)
    })
})
