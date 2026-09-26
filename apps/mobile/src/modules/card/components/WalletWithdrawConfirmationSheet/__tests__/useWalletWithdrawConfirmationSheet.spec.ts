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
import { CardWalletKind } from '@perawallet/wallet-core-chain-algorand/card'

const mocks = vi.hoisted(() => ({
    withdrawMutateAsync: vi.fn(),
    withdrawPending: false,
    wallet: null as unknown,
    resolve: vi.fn(),
    dismiss: vi.fn(),
    errorToast: vi.fn(),
    // Records which kind each hook was asked for, so a sheet opened for one
    // wallet is proven to never touch the other.
    kinds: {
        mutation: [] as string[],
        balance: [] as string[],
    },
}))

const wallet = {
    id: 'w_1',
    balance: new Decimal('42.5'),
    currency: 'usdc',
    isWithdrawable: true,
}

vi.mock('@perawallet/wallet-core-chain-algorand/card', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-chain-algorand/card',
    )
    return {
        ...actual,
        useWithdrawWalletBalanceMutation: (kind: string) => {
            mocks.kinds.mutation.push(kind)
            return {
                mutate: vi.fn(),
                mutateAsync: mocks.withdrawMutateAsync,
                isPending: mocks.withdrawPending,
                isError: false,
                isSuccess: false,
                isPaused: false,
                error: null,
                data: null,
                reset: vi.fn(),
            }
        },
        useCardWalletBalanceQuery: (kind: string) => {
            mocks.kinds.balance.push(kind)
            return {
                wallet: mocks.wallet,
                isLoading: false,
                isError: false,
                error: null,
                refetch: vi.fn(),
            }
        },
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

import { useWalletWithdrawConfirmationSheet } from '../useWalletWithdrawConfirmationSheet'

describe('useWalletWithdrawConfirmationSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.withdrawPending = false
        mocks.wallet = wallet
        mocks.kinds = { mutation: [], balance: [] }
    })

    it.each([CardWalletKind.Reward, CardWalletKind.Credit])(
        'drives every hook with the %s wallet it was opened for',
        kind => {
            const { result } = renderHook(() =>
                useWalletWithdrawConfirmationSheet({
                    kind,
                    amount: new Decimal('1'),
                }),
            )

            expect(new Set(mocks.kinds.mutation)).toEqual(new Set([kind]))
            expect(new Set(mocks.kinds.balance)).toEqual(new Set([kind]))
            expect(result.current.copy.confirmBody).toBe(
                kind === CardWalletKind.Reward
                    ? 'peraCard.rewards.confirm_body'
                    : 'peraCard.refunds.confirm_body',
            )
        },
    )

    it('withdraws the amount and resolves the sheet on confirm', async () => {
        mocks.withdrawMutateAsync.mockResolvedValue({
            txHash: '0xabc',
            network: 'linea',
            isConfirmed: true,
        })

        const { result } = renderHook(() =>
            useWalletWithdrawConfirmationSheet({
                kind: CardWalletKind.Reward,
                amount: new Decimal('25.5'),
            }),
        )
        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.withdrawMutateAsync).toHaveBeenCalledWith({
            amount: '25.50',
        })
        expect(mocks.resolve).toHaveBeenCalledWith('confirm')
    })

    it('blocks the withdraw when the wallet is not withdrawable', async () => {
        mocks.wallet = { ...wallet, isWithdrawable: false }

        const { result } = renderHook(() =>
            useWalletWithdrawConfirmationSheet({
                kind: CardWalletKind.Credit,
                amount: new Decimal('1'),
            }),
        )
        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.withdrawMutateAsync).not.toHaveBeenCalled()
        expect(mocks.errorToast).toHaveBeenCalled()
    })

    it('keeps the sheet open and surfaces the error on a failed withdraw', async () => {
        mocks.withdrawMutateAsync.mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() =>
            useWalletWithdrawConfirmationSheet({
                kind: CardWalletKind.Reward,
                amount: new Decimal('10'),
            }),
        )
        await act(async () => {
            result.current.onConfirm()
        })

        expect(mocks.resolve).not.toHaveBeenCalled()
        expect(mocks.errorToast).toHaveBeenCalled()
    })
})
