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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useTransactionAmounts } from '../useTransactionAmounts'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import {
    useSingleAssetDetailsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import type { UseQueryResult } from '@tanstack/react-query'

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useSingleAssetDetailsQuery: vi.fn(),
    }
})

const USER_ADDRESS = 'USER_ADDRESS'
const OTHER_ADDRESS = 'OTHER_ADDRESS'

const createPaymentTx = (
    overrides: Partial<TransactionHistoryItem> = {},
): TransactionHistoryItem =>
    ({
        id: 'tx1',
        txType: 'pay',
        sender: USER_ADDRESS,
        receiver: OTHER_ADDRESS,
        amount: new Decimal('500000'),
        fee: new Decimal('1000'),
        confirmedRound: 100,
        roundTime: 1_700_000_000,
        asset: null,
        swapGroupDetail: null,
        interpretedMeaning: null,
        applicationId: null,
        innerTransactionCount: null,
        groupId: null,
        closeTo: null,
        closeAmount: null,
        balanceImpacts: [],
        ...overrides,
    }) as TransactionHistoryItem

describe('useTransactionAmounts', () => {
    beforeEach(() => {
        vi.mocked(useSelectedAccount).mockReturnValue({
            address: USER_ADDRESS,
        } as ReturnType<typeof useSelectedAccount>)
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: undefined,
        } as UseQueryResult<PeraAsset, Error>)
    })

    it('shows a plain payment amount unchanged', () => {
        const { result } = renderHook(() =>
            useTransactionAmounts(createPaymentTx()),
        )

        expect(result.current.amounts).toHaveLength(1)
        expect(result.current.amounts[0].value.toString()).toBe('0.5')
        expect(result.current.amounts[0].currency).toBe('ALGO')
        expect(result.current.amounts[0].prefix).toBe('-')
    })

    it('includes the close amount in an outgoing close-out payment', () => {
        // A "send max" close-out carries the whole balance in closeAmount
        // with amount 0 — showing only `amount` renders "0 ALGO".
        const { result } = renderHook(() =>
            useTransactionAmounts(
                createPaymentTx({
                    amount: new Decimal(0),
                    closeTo: OTHER_ADDRESS,
                    closeAmount: new Decimal('50854132929'),
                }),
            ),
        )

        expect(result.current.amounts).toHaveLength(1)
        expect(result.current.amounts[0].value.toString()).toBe('50854.132929')
        expect(result.current.amounts[0].currency).toBe('ALGO')
        expect(result.current.amounts[0].prefix).toBe('-')
    })

    it('sums amount and close amount for the sender when both are set', () => {
        const { result } = renderHook(() =>
            useTransactionAmounts(
                createPaymentTx({
                    amount: new Decimal('1000000'),
                    closeTo: OTHER_ADDRESS,
                    closeAmount: new Decimal('2000000'),
                }),
            ),
        )

        expect(result.current.amounts).toHaveLength(1)
        expect(result.current.amounts[0].value.toString()).toBe('3')
        expect(result.current.amounts[0].prefix).toBe('-')
    })

    it('credits only the close amount to an incoming close-to account that is not the receiver', () => {
        // amount goes to `receiver`, closeAmount to `closeTo` — when they
        // differ, the close-to account must not be shown the receiver's cut.
        const { result } = renderHook(() =>
            useTransactionAmounts(
                createPaymentTx({
                    sender: OTHER_ADDRESS,
                    receiver: 'THIRD_ADDRESS',
                    amount: new Decimal('1000000'),
                    closeTo: USER_ADDRESS,
                    closeAmount: new Decimal('2000000'),
                }),
            ),
        )

        expect(result.current.amounts).toHaveLength(1)
        expect(result.current.amounts[0].value.toString()).toBe('2')
        expect(result.current.amounts[0].prefix).toBe('+')
    })

    it('falls back to the paid amount for a non-outgoing payment that names another receiver', () => {
        // Degenerate but historical behavior: when the selected account
        // matches no role on the row (e.g. account switch mid-render), show
        // the paid amount rather than a silent zero.
        const { result } = renderHook(() =>
            useTransactionAmounts(
                createPaymentTx({
                    sender: OTHER_ADDRESS,
                    receiver: 'THIRD_ADDRESS',
                    amount: new Decimal('500000'),
                }),
            ),
        )

        expect(result.current.amounts).toHaveLength(1)
        expect(result.current.amounts[0].value.toString()).toBe('0.5')
        expect(result.current.amounts[0].prefix).toBe('+')
    })

    it('includes the close amount in an asset opt-out transfer', () => {
        const { result } = renderHook(() =>
            useTransactionAmounts(
                createPaymentTx({
                    txType: 'axfer',
                    amount: new Decimal(0),
                    closeTo: OTHER_ADDRESS,
                    closeAmount: new Decimal('250000'),
                    asset: {
                        assetId: '31566704',
                        name: 'USD Coin',
                        unitName: 'USDC',
                        decimals: 6,
                    },
                }),
            ),
        )

        expect(result.current.amounts).toHaveLength(1)
        expect(result.current.amounts[0].value.toString()).toBe('0.25')
        expect(result.current.amounts[0].currency).toBe('USDC')
        expect(result.current.amounts[0].prefix).toBe('-')
    })
})
