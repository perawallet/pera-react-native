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

import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { TransactionListItem } from '../TransactionListItem'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'

const mockTransaction = {
    id: '1',
    txType: 'pay',
    sender: 'SENDER',
    receiver: 'RECEIVER',
} as unknown as TransactionHistoryItem

const mockResult = {
    iconType: 'payment',
    title: 'Payment',
    subtitle: 'RECEIVER',
    amounts: [
        { text: '1.00', isPositive: true, isNegative: false, hasAlgoIcon: true }
    ],
    handlePress: vi.fn(),
}

vi.mock('../useTransactionListItem', () => ({
    useTransactionListItem: () => mockResult,
}))

vi.mock('@src/utils/hooks/useSelectedAccount', () => ({
    useSelectedAccount: vi.fn(),
}))

describe('TransactionListItem', () => {
    it('renders title, subtitle and amount', () => {
        render(<TransactionListItem transaction={mockTransaction} />)
        
        expect(screen.getByText('Payment')).toBeTruthy()
        expect(screen.getByText('RECEIVER')).toBeTruthy()
        expect(screen.getByText('1.00')).toBeTruthy()
    })

    it('calls handlePress when pressed', () => {
        render(<TransactionListItem transaction={mockTransaction} />)
        
        fireEvent.click(screen.getByRole('button'))
        expect(mockResult.handlePress).toHaveBeenCalled()
    })
})
