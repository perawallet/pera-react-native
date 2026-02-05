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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTransactionListItem } from '../useTransactionListItem'
import {
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
    AccountTypes: {
        watch: 'watch',
    },
}))

const MOCK_USER_ADDRESS = 'USER_ADDRESS'

describe('useTransactionListItem', () => {
    beforeEach(() => {
        vi.mocked(useSelectedAccount).mockReturnValue({
            address: MOCK_USER_ADDRESS,
            type: 'watch',
            canSign: false,
        } as unknown as WalletAccount)
    })

    it('processes payment transaction correctly', () => {
        const transaction = {
            id: '1',
            txType: 'pay',
            sender: MOCK_USER_ADDRESS,
            receiver: 'RECEIVER_ADDRESS',
            amount: '1000000',
            fee: '1000',
            confirmedRound: 100,
            roundTime: 123456789,
        } as unknown as TransactionHistoryItem

        const { result } = renderHook(() =>
            useTransactionListItem({ transaction }),
        )

        expect(result.current.title).toBe('Payment')
        expect(result.current.subtitle).toBe('RECEIV..DDRESS')
        expect(result.current.iconType).toBe('payment')
        expect(result.current.amounts).toHaveLength(2) // 1.000 + fee
        expect(result.current.amounts[0]).toEqual({
            text: '-1.00',
            isPositive: false,
            isNegative: true,
            hasAlgoIcon: true,
        })
    })

    it('processes incoming payment correctly', () => {
        const transaction = {
            id: '2',
            txType: 'pay',
            sender: 'SENDER_ADDRESS',
            receiver: MOCK_USER_ADDRESS,
            amount: '2000000',
            fee: '1000',
            confirmedRound: 101,
            roundTime: 123456790,
        } as unknown as TransactionHistoryItem

        const { result } = renderHook(() =>
            useTransactionListItem({ transaction }),
        )

        expect(result.current.amounts[0]).toEqual({
            text: '2.00',
            isPositive: true,
            isNegative: false,
            hasAlgoIcon: true,
        })
    })

    it('processes swap transaction correctly', () => {
        const transaction = {
            id: '3',
            txType: 'appl',
            sender: MOCK_USER_ADDRESS,
            swapGroupDetail: {
                amountIn: '1000000',
                assetInUnitName: 'ALGO',
                amountOut: '5000000',
                assetOutUnitName: 'USDC',
            },
            fee: '2000',
            confirmedRound: 102,
            roundTime: 123456791,
        } as unknown as TransactionHistoryItem

        const { result } = renderHook(() =>
            useTransactionListItem({ transaction }),
        )

        expect(result.current.title).toBe('Swap')
        expect(result.current.iconType).toBe('asset-transfer')
        expect(result.current.amounts[0]).toEqual({
            text: '+ 5.00 USDC',
            isPositive: true,
            isNegative: false,
            hasAlgoIcon: false,
        })
    })

    it('handles asset transfer correctly', () => {
        const transaction = {
            id: '4',
            txType: 'axfer',
            sender: MOCK_USER_ADDRESS,
            receiver: 'RECEIVER_ADDRESS',
            amount: '100',
            asset: {
                assetId: 123,
                unitName: 'TEST',
                decimals: 2,
            },
            fee: '1000',
        } as unknown as TransactionHistoryItem

        const { result } = renderHook(() =>
            useTransactionListItem({ transaction }),
        )

        expect(result.current.amounts[0]).toEqual({
            text: '- 1.00 TEST',
            isPositive: false,
            isNegative: true,
            hasAlgoIcon: false,
        })
    })
})
