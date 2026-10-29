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

import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { AlgorandTransactionView } from '@perawallet/wallet-core-chain-algorand/blockchain'
import {
    useSingleAssetDetailsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { useAssetTransferSummaryHeader } from '../useAssetTransferSummaryHeader'

vi.mock(
    '@perawallet/wallet-core-chain-algorand/blockchain',
    async importOriginal => {
        const actual =
            await importOriginal<
                typeof import('@perawallet/wallet-core-chain-algorand/blockchain')
            >()
        return {
            ...actual,
            getAssetTransferType: vi.fn(() => 'transfer'),
        }
    },
)

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useSingleAssetDetailsQuery: vi.fn(),
    }
})

const txWithAmount = (amount: bigint) =>
    ({
        sender: 'SENDER',
        id: 'TX_ID',
        assetTransferTransaction: {
            receiver: 'RECEIVER',
            amount,
            assetId: 123n,
        },
    }) as unknown as AlgorandTransactionView

const mockAsset = (decimals?: number) =>
    vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
        data:
            decimals === undefined
                ? undefined
                : ({ assetId: '123', name: 'Test', decimals } as PeraAsset),
    } as UseQueryResult<PeraAsset, Error>)

describe('useAssetTransferSummaryHeader', () => {
    it('converts base units by the asset decimals', () => {
        mockAsset(6)

        const { result } = renderHook(() =>
            useAssetTransferSummaryHeader(txWithAmount(1_500_000n)),
        )

        expect(result.current.amount.toString()).toBe('1.5')
    })

    it('leaves the amount in base units while the asset is not loaded', () => {
        mockAsset(undefined)

        const { result } = renderHook(() =>
            useAssetTransferSummaryHeader(txWithAmount(1_500_000n)),
        )

        expect(result.current.amount.toString()).toBe('1500000')
    })

    it('converts a u64-max amount exactly', () => {
        mockAsset(6)

        const { result } = renderHook(() =>
            useAssetTransferSummaryHeader(
                txWithAmount(18_446_744_073_709_551_615n),
            ),
        )

        expect(result.current.amount.toString()).toBe('18446744073709.551615')
    })
})
