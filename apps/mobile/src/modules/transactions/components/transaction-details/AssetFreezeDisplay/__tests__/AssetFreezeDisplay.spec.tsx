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
import { AssetFreezeDisplay } from '../AssetFreezeDisplay'
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

describe('AssetFreezeDisplay', () => {
    const mockTransaction = {
        sender: 'SENDER_ADDRESS',
        fee: 1000n,
        assetFreezeTransaction: {
            assetId: 123n,
            address: 'TARGET_ADDRESS',
            newFreezeStatus: true,
        },
        id: 'TX_ID',
        txType: 'afrz',
    } as unknown as PeraDisplayableTransaction

    it('renders asset ID correctly', () => {
        const { container } = render(
            <AssetFreezeDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('123')
    })

    it('renders target address', () => {
        const { container } = render(
            <AssetFreezeDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('TARGET_ADDRESS')
    })

    it('renders frozen status correctly', () => {
        const { container } = render(
            <AssetFreezeDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain(
            'transactions.asset_freeze.frozen',
        )
    })

    it('renders unfrozen status correctly', () => {
        const unfrozenTx = {
            ...mockTransaction,
            assetFreezeTransaction: {
                ...mockTransaction.assetFreezeTransaction,
                newFreezeStatus: false,
            },
        } as unknown as PeraDisplayableTransaction

        const { container } = render(
            <AssetFreezeDisplay transaction={unfrozenTx} />,
        )

        expect(container.textContent).toContain(
            'transactions.asset_freeze.unfrozen',
        )
    })

    it('renders fee correctly', () => {
        const { container } = render(
            <AssetFreezeDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('ALGO0.001')
    })

    it('renders null if assetFreezeTransaction is missing', () => {
        const invalidTx = {
            ...mockTransaction,
            assetFreezeTransaction: undefined,
        } as unknown as PeraDisplayableTransaction

        const { container } = render(
            <AssetFreezeDisplay transaction={invalidTx} />,
        )

        expect(container.firstChild).toBeNull()
    })
})
