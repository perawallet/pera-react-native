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

import { render, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TransactionSigningView from '../TransactionSigningView'
import {
    TransactionSignRequest,
    useSigningRequest,
} from '@perawallet/wallet-core-blockchain'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        useSigningRequest: vi.fn(() => ({
            removeSignRequest: vi.fn(),
        })),
        useAlgorandClient: vi.fn(() => ({
            client: { algod: { sendRawTransaction: vi.fn() } },
        })),
        useTransactionEncoder: vi.fn(() => ({
            encodeSignedTransactions: vi.fn(),
        })),
        encodeAlgorandAddress: vi.fn(() => 'ENCODED_ADDRESS'),
    }
})

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useTransactionSigner: vi.fn(() => ({
            signTransactions: vi.fn().mockResolvedValue([]),
        })),
    }
})

describe('TransactionSigningView', () => {
    const mockSingleTxRequest = {
        type: 'transactions',
        transport: 'callback',
        txs: [
            [
                {
                    payment: {
                        receiver: { publicKey: new Uint8Array(32) },
                    },
                },
            ],
        ],
        approve: vi.fn(),
        reject: vi.fn(),
    } as unknown as TransactionSignRequest

    const mockGroupTxRequest = {
        type: 'transactions',
        transport: 'callback',
        txs: [
            [{ payment: { receiver: { publicKey: new Uint8Array(32) } } }],
            [{ payment: { receiver: { publicKey: new Uint8Array(32) } } }],
        ],
        approve: vi.fn(),
        reject: vi.fn(),
    } as unknown as TransactionSignRequest

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders cancel and confirm buttons', () => {
        const { container } = render(
            <TransactionSigningView request={mockSingleTxRequest} />,
        )
        const text = container.textContent?.toLowerCase() || ''
        expect(text).toContain('cancel')
        expect(text).toContain('confirm')
    })

    it('shows Confirm All for multiple transactions', () => {
        const { container } = render(
            <TransactionSigningView request={mockGroupTxRequest} />,
        )
        const text = container.textContent?.toLowerCase() || ''
        expect(text).toContain('confirm')
        expect(text).toContain('all')
    })

    it('shows single confirm for single transaction', () => {
        const { container } = render(
            <TransactionSigningView request={mockSingleTxRequest} />,
        )
        // Should show "Confirm" - check it renders buttons
        const text = container.textContent?.toLowerCase() || ''
        expect(text).toContain('confirm')
    })

    it('displays empty view when no receiver is present', () => {
        const invalidRequest = {
            type: 'transactions',
            transport: 'callback',
            txs: [[{}]], // No receiver
        } as unknown as TransactionSignRequest

        const { container } = render(
            <TransactionSigningView request={invalidRequest} />,
        )
        expect(container.textContent?.toLowerCase()).toContain('invalid')
    })

    it('calls removeSignRequest on cancel', () => {
        const removeSignRequest = vi.fn()
        vi.mocked(useSigningRequest).mockReturnValue({
            removeSignRequest,
        } as unknown as ReturnType<typeof useSigningRequest>)

        const { container } = render(
            <TransactionSigningView request={mockSingleTxRequest} />,
        )

        const buttons = container.querySelectorAll('button')
        const cancelButton = Array.from(buttons).find(btn =>
            btn.textContent?.toLowerCase().includes('cancel'),
        )
        if (cancelButton) {
            fireEvent.click(cancelButton)
            expect(removeSignRequest).toHaveBeenCalledWith(mockSingleTxRequest)
        }
    })
})
