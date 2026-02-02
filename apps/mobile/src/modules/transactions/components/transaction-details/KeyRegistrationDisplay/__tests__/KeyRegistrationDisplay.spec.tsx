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
import { describe, it, expect, vi } from 'vitest'
import { KeyRegistrationDisplay } from '../KeyRegistrationDisplay'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        microAlgosToAlgos: vi.fn(
            (amount: bigint) => Number(amount) / 1_000_000,
        ),
        encodeAlgorandAddress: vi.fn(() => 'ENCODED_ADDRESS'),
    }
})

describe('KeyRegistrationDisplay', () => {
    const mockTransaction = {
        sender: 'SENDER_ADDRESS',
        fee: 1000n,
        keyregTransaction: {
            voteFirstValid: 1000n,
            voteLastValid: 2000n,
            voteKeyDilution: 10n,
            voteParticipationKey: 'VOTE_KEY',
            selectionParticipationKey: 'SELECTION_KEY',
            nonParticipation: false,
        },
        id: 'TX_ID',
        txType: 'keyreg',
    } as unknown as PeraDisplayableTransaction

    it('renders online status correctly', () => {
        const { container } = render(
            <KeyRegistrationDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('transactions.key_reg.online')
    })

    it('renders offline status correctly', () => {
        const offlineTx = {
            ...mockTransaction,
            keyregTransaction: {
                ...mockTransaction.keyregTransaction,
                nonParticipation: true,
            },
        } as unknown as PeraDisplayableTransaction

        const { container } = render(
            <KeyRegistrationDisplay transaction={offlineTx} />,
        )

        expect(container.textContent).toContain('transactions.key_reg.offline')
    })

    it('renders participation keys correctly when online', () => {
        const { container } = render(
            <KeyRegistrationDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('VOTE_KEY')
        expect(container.textContent).toContain('SELECTION_KEY')
    })

    it('renders valid rounds correctly', () => {
        const { container } = render(
            <KeyRegistrationDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('1000 - 2000')
    })

    it('renders fee correctly', () => {
        const { container } = render(
            <KeyRegistrationDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('ALGO0.001')
    })
})
