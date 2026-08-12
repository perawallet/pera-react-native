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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { useCollectibleItem } from '../useCollectibleItem'
import type { CollectibleDisplayItem } from '@modules/assets/types/collectible'

const mockCopyToClipboard = vi.fn()

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

vi.mock('@perawallet/wallet-core-assets', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-assets')
    >('@perawallet/wallet-core-assets')
    return {
        ...actual,
        isPureNft: (asset: PeraAsset) => asset.totalSupply.equals(1),
    }
})

const buildAsset = (overrides: Partial<PeraAsset> = {}): PeraAsset =>
    ({
        assetId: '12345',
        decimals: 0,
        creator: { address: 'CREATOR' },
        totalSupply: new Decimal(1),
        name: 'Cool NFT',
        unitName: 'COOL',
        peraMetadata: {
            isDeleted: false,
            verificationTier: 'verified',
            logo: 'https://example.com/logo.png',
        },
        ...overrides,
    }) as PeraAsset

const buildItem = (
    overrides: Partial<CollectibleDisplayItem> = {},
): CollectibleDisplayItem => ({
    assetId: '12345',
    asset: buildAsset(),
    amount: new Decimal(1),
    ...overrides,
})

describe('useCollectibleItem', () => {
    it('derives display fields from the underlying asset', () => {
        const { result } = renderHook(() =>
            useCollectibleItem({ item: buildItem() }),
        )

        expect(result.current.thumbnailUrl).toBe('https://example.com/logo.png')
        expect(result.current.title).toBe('Cool NFT')
        expect(result.current.hasBalance).toBe(true)
        expect(result.current.verificationIconName).toBe('assets/verified')
    })

    it('prefers collectible primary image over asset logo for thumbnail', () => {
        const collectible = {
            primaryImage: 'https://example.com/primary.png',
            collection: { name: 'Cool Collection' },
        } as CollectibleDisplayItem['collectible']

        const item = buildItem({
            asset: buildAsset({
                peraMetadata: {
                    isDeleted: false,
                    verificationTier: 'verified',
                    logo: 'https://example.com/logo.png',
                    collectible,
                } as PeraAsset['peraMetadata'],
            }),
            collectible,
        })

        const { result } = renderHook(() => useCollectibleItem({ item }))

        expect(result.current.thumbnailUrl).toBe(
            'https://example.com/primary.png',
        )
        expect(result.current.collectionLabel).toBe('Cool Collection')
    })

    it('falls back to asset unit name for collectionLabel when collection name is absent', () => {
        const { result } = renderHook(() =>
            useCollectibleItem({ item: buildItem() }),
        )

        expect(result.current.collectionLabel).toBe('COOL')
    })

    it('falls back to asset id when name and collectible title are missing', () => {
        const item = buildItem({
            asset: buildAsset({ name: undefined }),
        })

        const { result } = renderHook(() => useCollectibleItem({ item }))

        expect(result.current.title).toBe('#12345')
    })

    it('reports hasBalance=false for opted-in-only items', () => {
        const item = buildItem({ amount: new Decimal(0) })

        const { result } = renderHook(() => useCollectibleItem({ item }))

        expect(result.current.hasBalance).toBe(false)
        expect(result.current.showAmount).toBe(false)
    })

    it('copies the asset id on long press', () => {
        mockCopyToClipboard.mockClear()
        const { result } = renderHook(() =>
            useCollectibleItem({ item: buildItem() }),
        )

        result.current.handleLongPress()

        expect(mockCopyToClipboard).toHaveBeenCalledWith('12345')
    })
})
