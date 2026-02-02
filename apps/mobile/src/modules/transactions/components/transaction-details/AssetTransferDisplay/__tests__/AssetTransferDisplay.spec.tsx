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
import { AssetTransferDisplay } from '../AssetTransferDisplay'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import {
    PeraAsset,
    useSingleAssetDetailsQuery,
} from '@perawallet/wallet-core-assets'
import { UseQueryResult } from '@tanstack/react-query'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        getAssetTransferType: vi.fn(() => 'transfer'),
        microAlgosToAlgos: vi.fn(
            (amount: bigint) => Number(amount) / 1_000_000,
        ),
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
        useAllAccounts: vi.fn(() => []),
    }
})

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useSingleAssetDetailsQuery: vi.fn(),
    }
})

describe('AssetTransferDisplay', () => {
    const mockAsset = {
        assetId: '123',
        name: 'Test Asset',
        unitName: 'TEST',
        decimals: 6,
    }

    const mockTransaction = {
        sender: 'SENDER_ADDRESS',
        fee: 1000n,
        assetTransferTransaction: {
            receiver: 'RECEIVER_ADDRESS',
            amount: 1000000n,
            assetId: 123n,
        },
        id: 'TX_ID',
        txType: 'axfer',
    } as unknown as PeraDisplayableTransaction

    it('renders asset amount correctly', () => {
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: mockAsset,
        } as UseQueryResult<NoInfer<PeraAsset>, unknown>)

        const { container } = render(
            <AssetTransferDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('TEST1')
    })

    it('renders sender and receiver addresses', () => {
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: mockAsset,
        } as UseQueryResult<NoInfer<PeraAsset>, unknown>)

        const { container } = render(
            <AssetTransferDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('SENDER_ADDRESS')
        expect(container.textContent).toContain('RECEIVER_ADDRESS')
    })

    it('renders AssetTitle when asset is loaded', () => {
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: mockAsset,
        } as UseQueryResult<NoInfer<PeraAsset>, unknown>)

        const { container } = render(
            <AssetTransferDisplay transaction={mockTransaction} />,
        )

        expect(container.textContent).toContain('Test Asset')
        expect(container.textContent).toContain('123')
    })

    it('renders null if assetTransferTransaction is missing', () => {
        const invalidTx = {
            ...mockTransaction,
            assetTransferTransaction: undefined,
        } as unknown as PeraDisplayableTransaction

        const { container } = render(
            <AssetTransferDisplay transaction={invalidTx} />,
        )

        expect(container.firstChild).toBeNull()
    })
})
