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
import { useAssetConfigDisplay } from '../useAssetConfigDisplay'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import type { Decimal } from 'decimal.js'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        getAssetConfigType: vi.fn(() => 'create'),
    }
})

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        formatNumber: vi.fn((val: number | Decimal) => ({
            integer: val.toString(),
            fraction: '',
        })),
        formatWithUnits: vi.fn((val: number | Decimal) => ({
            amount: val.toString(),
            unit: '',
        })),
    }
})

describe('useAssetConfigDisplay', () => {
    const baseTx = {
        sender: 'SENDER',
        fee: 1000n,
        id: 'TX_ID',
        assetConfigTransaction: {
            assetId: 12_345n,
            params: {
                name: 'Test',
                total: 1_000_000n,
            },
        },
    } as unknown as PeraDisplayableTransaction

    it('decodes metadataHash from buffer to utf-8 string', () => {
        const tx = {
            ...baseTx,
            assetConfigTransaction: {
                ...baseTx.assetConfigTransaction,
                params: {
                    ...baseTx.assetConfigTransaction!.params,
                    metadataHash: Buffer.from('test-metadata-hash'),
                },
            },
        } as unknown as PeraDisplayableTransaction

        const { result } = renderHook(() => useAssetConfigDisplay(tx))

        expect(result.current.metadataHash).toBe('test-metadata-hash')
    })

    it('returns undefined metadataHash when not present', () => {
        const { result } = renderHook(() => useAssetConfigDisplay(baseTx))

        expect(result.current.metadataHash).toBeUndefined()
    })

    it('returns undefined metadataHash for a persisted-cache-poisoned index-keyed plain object', () => {
        const tx = {
            ...baseTx,
            assetConfigTransaction: {
                ...baseTx.assetConfigTransaction,
                params: {
                    ...baseTx.assetConfigTransaction!.params,
                    metadataHash: JSON.parse(
                        JSON.stringify(
                            new Uint8Array(Buffer.from('test-metadata-hash')),
                        ),
                    ),
                },
            },
        } as unknown as PeraDisplayableTransaction

        const { result } = renderHook(() => useAssetConfigDisplay(tx))

        expect(result.current.metadataHash).toBeUndefined()
    })

    it('decodes metadataHash for a persisted-cache Buffer-JSON shape', () => {
        const tx = {
            ...baseTx,
            assetConfigTransaction: {
                ...baseTx.assetConfigTransaction,
                params: {
                    ...baseTx.assetConfigTransaction!.params,
                    metadataHash: JSON.parse(
                        JSON.stringify(Buffer.from('test-metadata-hash')),
                    ),
                },
            },
        } as unknown as PeraDisplayableTransaction

        const { result } = renderHook(() => useAssetConfigDisplay(tx))

        expect(result.current.metadataHash).toBe('test-metadata-hash')
    })

    it('sets showWarnings to true when transaction has no id', () => {
        const tx = {
            ...baseTx,
            id: undefined,
        } as unknown as PeraDisplayableTransaction

        const { result } = renderHook(() => useAssetConfigDisplay(tx))

        expect(result.current.showWarnings).toBe(true)
    })

    it('sets showWarnings to false when transaction has id', () => {
        const { result } = renderHook(() => useAssetConfigDisplay(baseTx))

        expect(result.current.showWarnings).toBe(false)
    })
})
