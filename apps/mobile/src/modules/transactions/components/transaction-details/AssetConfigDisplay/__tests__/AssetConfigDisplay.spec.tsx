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
import { AssetConfigDisplay } from '../AssetConfigDisplay'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import Decimal from 'decimal.js'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        getAssetConfigType: vi.fn((tx: PeraDisplayableTransaction) => {
            if (tx.assetConfigTransaction?.assetId === 0n) return 'create'
            return 'update'
        }),
        microAlgosToAlgos: vi.fn(
            (amount: bigint) => Number(amount) / 1_000_000,
        ),
        encodeAlgorandAddress: vi.fn(() => 'ENCODED_ADDRESS'),
    }
})

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        DEFAULT_PRECISION: 6,
        formatNumber: vi.fn((val: number | Decimal) => ({
            integer: val.toString(),
            fraction: '',
        })),
        formatWithUnits: vi.fn((val: number | Decimal) => ({
            amount: val.toString(),
            unit: '',
        })),
        formatCurrency: vi.fn(
            (value, _decimals, currency) => `${currency}${value}`,
        ),
        truncateAlgorandAddress: vi.fn(a => a),
    }
})

describe('AssetConfigDisplay', () => {
    const mockTransaction = {
        sender: 'SENDER_ADDRESS',
        fee: 1000n,
        assetConfigTransaction: {
            assetId: 12345n,
            params: {
                name: 'Test Asset',
                unitName: 'TEST',
                url: 'https://test.com',
                total: 1000000n,
                decimals: 6,
                manager: 'MANAGER_ADDRESS',
            },
        },
        id: 'TX_ID',
        txType: 'acfg',
    } as unknown as PeraDisplayableTransaction

    it('renders asset ID correctly when not creating', () => {
        const { container } = render(
            <AssetConfigDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('12345')
    })

    it('renders asset name and unit correctly when creating', () => {
        const createTx = {
            ...mockTransaction,
            assetConfigTransaction: {
                ...mockTransaction.assetConfigTransaction,
                assetId: 0n,
            },
        } as unknown as PeraDisplayableTransaction

        const { container } = render(
            <AssetConfigDisplay transaction={createTx} />,
        )

        expect(container.textContent).toContain('Test Asset')
        expect(container.textContent).toContain('TEST')
    })

    it('renders manager address if present', () => {
        const { container } = render(
            <AssetConfigDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('MANAGER_ADDRESS')
    })

    it('renders fee correctly', () => {
        const { container } = render(
            <AssetConfigDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('ALGO0.001')
    })

    it('renders null if assetConfigTransaction is missing', () => {
        const invalidTx = {
            ...mockTransaction,
            assetConfigTransaction: undefined,
        } as unknown as PeraDisplayableTransaction

        const { container } = render(
            <AssetConfigDisplay transaction={invalidTx} />,
        )

        expect(container.firstChild).toBeNull()
    })
})
