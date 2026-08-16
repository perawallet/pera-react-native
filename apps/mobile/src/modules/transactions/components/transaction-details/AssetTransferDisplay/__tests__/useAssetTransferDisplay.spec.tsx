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
import { useAssetTransferDisplay } from '../useAssetTransferDisplay'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import {
    useSingleAssetDetailsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type { UseQueryResult } from '@tanstack/react-query'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        getAssetTransferType: vi.fn(() => 'transfer'),
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

describe('useAssetTransferDisplay', () => {
    const baseTx = {
        sender: 'SENDER',
        fee: 1000n,
        id: 'TX_ID',
        assetTransferTransaction: {
            receiver: 'RECEIVER',
            amount: 1_000_000n,
            assetId: 123n,
        },
    } as unknown as PeraDisplayableTransaction

    it('exposes the sweep separately when the sender opted out of the asset', () => {
        // An opt-out has amount 0 and the remaining holding in closeAmount —
        // reading only `amount` renders 0 (PERA-4897).
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: { assetId: '123', name: 'Test', decimals: 6 },
        } as UseQueryResult<PeraAsset, Error>)

        const optOutTx = {
            ...baseTx,
            assetTransferTransaction: {
                receiver: 'RECEIVER',
                amount: 0n,
                assetId: 123n,
                closeTo: 'RECEIVER',
                closeAmount: 250_000n,
            },
        } as unknown as PeraDisplayableTransaction

        const { result } = renderHook(() =>
            useAssetTransferDisplay(optOutTx, 'SENDER'),
        )

        // Amount stays the paid leg (0 for an opt-out); the sweep lives in
        // its own Remainder Amount row.
        expect(result.current.amount.toString()).toBe('0')
        expect(result.current.closeToAddress).toBe('RECEIVER')
        expect(result.current.closeAmountValue?.toString()).toBe('0.25')
    })

    it('returns asset metadata as metadataHash when present', () => {
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: {
                assetId: '123',
                name: 'Test',
                decimals: 6,
                metadata: 'some-metadata-value',
            },
        } as UseQueryResult<PeraAsset, Error>)

        const { result } = renderHook(() => useAssetTransferDisplay(baseTx))

        expect(result.current.metadataHash).toBe('some-metadata-value')
    })

    it('returns undefined metadataHash when asset has no metadata', () => {
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: {
                assetId: '123',
                name: 'Test',
                decimals: 6,
            },
        } as UseQueryResult<PeraAsset, Error>)

        const { result } = renderHook(() => useAssetTransferDisplay(baseTx))

        expect(result.current.metadataHash).toBeUndefined()
    })

    it('reports pending state while the asset query is in flight', () => {
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: undefined,
            isPending: true,
        } as UseQueryResult<PeraAsset, Error>)

        const { result } = renderHook(() => useAssetTransferDisplay(baseTx))

        expect(result.current.isAssetPending).toBe(true)
        expect(result.current.asset).toBeUndefined()
    })

    it('reports a settled miss (not pending) so the UI can show a bounded placeholder', () => {
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: undefined,
            isPending: false,
        } as UseQueryResult<PeraAsset, Error>)

        const { result } = renderHook(() => useAssetTransferDisplay(baseTx))

        expect(result.current.isAssetPending).toBe(false)
        expect(result.current.asset).toBeUndefined()
    })
})
