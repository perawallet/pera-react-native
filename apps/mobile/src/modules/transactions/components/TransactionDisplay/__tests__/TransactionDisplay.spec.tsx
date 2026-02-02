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

import { render } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TransactionDisplay } from '../TransactionDisplay'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        getTransactionType: vi.fn(),
    }
})

vi.mock('../../transaction-details', () => ({
    PaymentTransactionDisplay: vi.fn(() => (
        <div data-testid="payment-display">Payment Display</div>
    )),
    AssetTransferDisplay: vi.fn(() => (
        <div data-testid="asset-transfer-display">Asset Transfer Display</div>
    )),
    AssetConfigDisplay: vi.fn(() => (
        <div data-testid="asset-config-display">Asset Config Display</div>
    )),
    AssetFreezeDisplay: vi.fn(() => (
        <div data-testid="asset-freeze-display">Asset Freeze Display</div>
    )),
    KeyRegistrationDisplay: vi.fn(() => (
        <div data-testid="key-registration-display">
            Key Registration Display
        </div>
    )),
    AppCallTransactionDisplay: vi.fn(() => (
        <div data-testid="app-call-display">App Call Display</div>
    )),
}))

vi.mock('@components/EmptyView', () => ({
    EmptyView: vi.fn(({ title }) => (
        <div data-testid="empty-view">{title}</div>
    )),
}))

describe('TransactionDisplay', () => {
    const mockTransaction = {
        sender: 'TEST_SENDER_ADDRESS',
        fee: 1000n,
        txType: 'pay',
    } as unknown as PeraDisplayableTransaction

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders PaymentTransactionDisplay for payment transactions', async () => {
        const { getTransactionType } = await import(
            '@perawallet/wallet-core-blockchain'
        )
        vi.mocked(getTransactionType).mockReturnValue('payment')

        const { getByTestId } = render(
            <TransactionDisplay transaction={mockTransaction} />,
        )

        expect(getByTestId('payment-display')).toBeTruthy()
    })

    it('renders AssetTransferDisplay for asset-transfer transactions', async () => {
        const { getTransactionType } = await import(
            '@perawallet/wallet-core-blockchain'
        )
        vi.mocked(getTransactionType).mockReturnValue('asset-transfer')

        const { getByTestId } = render(
            <TransactionDisplay transaction={mockTransaction} />,
        )

        expect(getByTestId('asset-transfer-display')).toBeTruthy()
    })

    it('renders AssetConfigDisplay for asset-config transactions', async () => {
        const { getTransactionType } = await import(
            '@perawallet/wallet-core-blockchain'
        )
        vi.mocked(getTransactionType).mockReturnValue('asset-config')

        const { getByTestId } = render(
            <TransactionDisplay transaction={mockTransaction} />,
        )

        expect(getByTestId('asset-config-display')).toBeTruthy()
    })

    it('renders AssetFreezeDisplay for asset-freeze transactions', async () => {
        const { getTransactionType } = await import(
            '@perawallet/wallet-core-blockchain'
        )
        vi.mocked(getTransactionType).mockReturnValue('asset-freeze')

        const { getByTestId } = render(
            <TransactionDisplay transaction={mockTransaction} />,
        )

        expect(getByTestId('asset-freeze-display')).toBeTruthy()
    })

    it('renders KeyRegistrationDisplay for key-registration transactions', async () => {
        const { getTransactionType } = await import(
            '@perawallet/wallet-core-blockchain'
        )
        vi.mocked(getTransactionType).mockReturnValue('key-registration')

        const { getByTestId } = render(
            <TransactionDisplay transaction={mockTransaction} />,
        )

        expect(getByTestId('key-registration-display')).toBeTruthy()
    })

    it('renders AppCallTransactionDisplay for app-call transactions', async () => {
        const { getTransactionType } = await import(
            '@perawallet/wallet-core-blockchain'
        )
        vi.mocked(getTransactionType).mockReturnValue('app-call')

        const { getByTestId } = render(
            <TransactionDisplay transaction={mockTransaction} />,
        )

        expect(getByTestId('app-call-display')).toBeTruthy()
    })

    it('renders EmptyView for unknown transaction types', async () => {
        const { getTransactionType } = await import(
            '@perawallet/wallet-core-blockchain'
        )
        vi.mocked(getTransactionType).mockReturnValue('unknown')

        const { getByTestId } = render(
            <TransactionDisplay transaction={mockTransaction} />,
        )

        expect(getByTestId('empty-view')).toBeTruthy()
    })

    it('renders EmptyView for state-proof transaction types', async () => {
        const { getTransactionType } = await import(
            '@perawallet/wallet-core-blockchain'
        )
        vi.mocked(getTransactionType).mockReturnValue('state-proof')

        const { getByTestId } = render(
            <TransactionDisplay transaction={mockTransaction} />,
        )

        expect(getByTestId('empty-view')).toBeTruthy()
    })

    it('renders EmptyView for heartbeat transaction types', async () => {
        const { getTransactionType } = await import(
            '@perawallet/wallet-core-blockchain'
        )
        vi.mocked(getTransactionType).mockReturnValue('heartbeat')

        const { getByTestId } = render(
            <TransactionDisplay transaction={mockTransaction} />,
        )

        expect(getByTestId('empty-view')).toBeTruthy()
    })

    it('passes isInnerTransaction prop to child components', async () => {
        const { getTransactionType } = await import(
            '@perawallet/wallet-core-blockchain'
        )
        vi.mocked(getTransactionType).mockReturnValue('payment')

        const { PaymentTransactionDisplay } = await import(
            '../../transaction-details'
        )

        render(
            <TransactionDisplay
                transaction={mockTransaction}
                isInnerTransaction={true}
            />,
        )

        expect(PaymentTransactionDisplay).toHaveBeenCalledWith(
            expect.objectContaining({
                transaction: mockTransaction,
                isInnerTransaction: true,
            }),
            expect.anything(),
        )
    })

    it('passes onInnerTransactionsPress to AppCallTransactionDisplay', async () => {
        const { getTransactionType } = await import(
            '@perawallet/wallet-core-blockchain'
        )
        vi.mocked(getTransactionType).mockReturnValue('app-call')

        const { AppCallTransactionDisplay } = await import(
            '../../transaction-details'
        )

        const mockOnPress = vi.fn()

        render(
            <TransactionDisplay
                transaction={mockTransaction}
                onInnerTransactionsPress={mockOnPress}
            />,
        )

        expect(AppCallTransactionDisplay).toHaveBeenCalledWith(
            expect.objectContaining({
                transaction: mockTransaction,
                onInnerTransactionsPress: mockOnPress,
            }),
            expect.anything(),
        )
    })
})
