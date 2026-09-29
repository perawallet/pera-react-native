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

import { describe, test, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    transformCollectibleResponse,
    transformAssetResponse,
    transformIndexerAssetResponse,
    resolveMediaType,
} from '../transformers'
import type {
    CollectibleResponse,
    AssetResponse,
    IndexerAssetResponse,
} from '../schema'

const createCollectibleResponse = (
    overrides: Partial<CollectibleResponse> = {},
): CollectibleResponse => ({
    title: 'Cool NFT #42',
    standard: 'arc3',
    primary_image: 'https://example.com/nft.png',
    media_type: 'image',
    explorer_url: 'https://explorer.perawallet.app/asset/123',
    collection: {
        id: 1,
        name: 'Cool Collection',
        description: 'A cool collection',
    },
    description: 'A very cool NFT',
    traits: [
        { display_name: 'Background', display_value: 'Blue' },
        { display_name: 'Rarity', display_value: 'Rare' },
    ],
    media: [
        {
            type: 'image',
            download_url: 'https://example.com/nft-full.png',
            preview_url: 'https://example.com/nft-thumb.png',
            extension: 'png',
        },
    ],
    ...overrides,
})

const createAssetResponse = (
    overrides: Partial<AssetResponse> = {},
): AssetResponse => ({
    asset_id: 12345,
    name: 'Test Asset',
    logo: 'https://example.com/logo.png',
    unit_name: 'TEST',
    fraction_decimals: 0,
    total: '1',
    usd_value: null,
    is_verified: true,
    is_deleted: false,
    verification_tier: 'verified',
    explorer_url: 'https://explorer.perawallet.app/asset/12345',
    collectible: null,
    creator: { address: 'CREATOR_ADDRESS' },
    type: 'standard_asset',
    category: null,
    labels: null,
    is_favorited: false,
    is_price_alert_enabled: false,
    description: null,
    url: null,
    project_url: null,
    project_name: null,
    discord_url: null,
    telegram_url: null,
    twitter_username: null,
    ...overrides,
})

describe('transformCollectibleResponse', () => {
    test('transforms all fields from snake_case to camelCase', () => {
        const input = createCollectibleResponse()
        const result = transformCollectibleResponse(input)

        expect(result.title).toBe('Cool NFT #42')
        expect(result.standard).toBe('arc3')
        expect(result.primaryImage).toBe('https://example.com/nft.png')
        expect(result.mediaType).toBe('image')
        expect(result.explorerUrl).toBe(
            'https://explorer.perawallet.app/asset/123',
        )
        expect(result.description).toBe('A very cool NFT')
    })

    test('transforms collection', () => {
        const result = transformCollectibleResponse(createCollectibleResponse())

        expect(result.collection).toEqual({
            id: 1,
            name: 'Cool Collection',
            description: 'A cool collection',
        })
    })

    test('transforms traits', () => {
        const result = transformCollectibleResponse(createCollectibleResponse())

        expect(result.traits).toEqual([
            { displayName: 'Background', displayValue: 'Blue' },
            { displayName: 'Rarity', displayValue: 'Rare' },
        ])
    })

    test('transforms media items', () => {
        const result = transformCollectibleResponse(createCollectibleResponse())

        expect(result.media).toEqual([
            {
                type: 'image',
                downloadUrl: 'https://example.com/nft-full.png',
                previewUrl: 'https://example.com/nft-thumb.png',
                extension: 'png',
            },
        ])
    })

    test('handles multiple media types', () => {
        const input = createCollectibleResponse({
            media_type: 'mixed',
            media: [
                {
                    type: 'image',
                    download_url: 'https://example.com/image.png',
                    preview_url: 'https://example.com/image-thumb.png',
                    extension: 'png',
                },
                {
                    type: 'video',
                    download_url: 'https://example.com/video.mp4',
                    preview_url: 'https://example.com/video-thumb.jpg',
                    extension: 'mp4',
                },
                {
                    type: 'audio',
                    download_url: 'https://example.com/audio.mp3',
                    extension: 'mp3',
                },
            ],
        })
        const result = transformCollectibleResponse(input)

        expect(result.mediaType).toBe('mixed')
        expect(result.media).toHaveLength(3)
        expect(result.media![0].type).toBe('image')
        expect(result.media![1].type).toBe('video')
        expect(result.media![2].type).toBe('audio')
        expect(result.media![2].previewUrl).toBeUndefined()
    })

    test('handles empty traits and media arrays', () => {
        const input = createCollectibleResponse({
            traits: [],
            media: [],
        })
        const result = transformCollectibleResponse(input)

        expect(result.traits).toEqual([])
        expect(result.media).toEqual([])
    })

    test('handles optional fields being undefined', () => {
        const input = createCollectibleResponse({
            title: undefined,
            standard: undefined,
            primary_image: undefined,
            description: undefined,
        })
        const result = transformCollectibleResponse(input)

        expect(result.title).toBeUndefined()
        expect(result.standard).toBeUndefined()
        expect(result.primaryImage).toBeUndefined()
        expect(result.description).toBeUndefined()
    })

    test('handles arc69 standard', () => {
        const result = transformCollectibleResponse(
            createCollectibleResponse({ standard: 'arc69' }),
        )

        expect(result.standard).toBe('arc69')
    })

    test('handles unknown media type', () => {
        const result = transformCollectibleResponse(
            createCollectibleResponse({ media_type: 'unknown' }),
        )

        expect(result.mediaType).toBe('unknown')
    })

    test('handles trait with missing display_name', () => {
        const input = createCollectibleResponse({
            traits: [{ display_value: 'SomeValue' }],
        })
        const result = transformCollectibleResponse(input)

        expect(result.traits).toEqual([
            { displayName: undefined, displayValue: 'SomeValue' },
        ])
    })

    test('handles null collection', () => {
        const input = createCollectibleResponse({
            collection: null as any,
        })
        const result = transformCollectibleResponse(input)

        expect(result.collection).toBeUndefined()
    })

    test('handles undefined traits', () => {
        const input = createCollectibleResponse({
            traits: undefined as any,
        })
        const result = transformCollectibleResponse(input)

        expect(result.traits).toEqual([])
    })

    test('handles undefined media', () => {
        const input = createCollectibleResponse({
            media: undefined as any,
        })
        const result = transformCollectibleResponse(input)

        expect(result.media).toEqual([])
    })
})

describe('resolveMediaType', () => {
    test('reclassifies unknown type with glb extension as model', () => {
        expect(resolveMediaType('unknown', 'glb')).toBe('model')
    })

    test('reclassifies unknown type with gltf extension as model', () => {
        expect(resolveMediaType('unknown', 'gltf')).toBe('model')
    })

    test('reclassifies unknown type with usdz extension as model', () => {
        expect(resolveMediaType('unknown', 'usdz')).toBe('model')
    })

    test('handles case-insensitive extensions', () => {
        expect(resolveMediaType('unknown', 'GLB')).toBe('model')
        expect(resolveMediaType('unknown', 'Gltf')).toBe('model')
    })

    test('does not reclassify non-unknown types', () => {
        expect(resolveMediaType('image', 'glb')).toBe('image')
        expect(resolveMediaType('video', 'gltf')).toBe('video')
    })

    test('leaves unknown type with non-model extension unchanged', () => {
        expect(resolveMediaType('unknown', 'png')).toBe('unknown')
        expect(resolveMediaType('unknown', 'mp4')).toBe('unknown')
    })

    test('passes through known types unchanged', () => {
        expect(resolveMediaType('image', 'png')).toBe('image')
        expect(resolveMediaType('video', 'mp4')).toBe('video')
        expect(resolveMediaType('audio', 'mp3')).toBe('audio')
    })
})

describe('transformCollectibleResponse — model media', () => {
    test('reclassifies unknown media with glb extension to model', () => {
        const input = createCollectibleResponse({
            media: [
                {
                    type: 'unknown',
                    download_url: 'https://example.com/model.glb',
                    preview_url: 'https://example.com/thumb.jpg',
                    extension: 'glb',
                },
            ],
        })
        const result = transformCollectibleResponse(input)

        expect(result.media![0].type).toBe('model')
    })

    test('preserves known types during media transformation', () => {
        const input = createCollectibleResponse({
            media: [
                {
                    type: 'image',
                    download_url: 'https://example.com/image.png',
                    extension: 'png',
                },
                {
                    type: 'unknown',
                    download_url: 'https://example.com/model.gltf',
                    extension: 'gltf',
                },
            ],
        })
        const result = transformCollectibleResponse(input)

        expect(result.media![0].type).toBe('image')
        expect(result.media![1].type).toBe('model')
    })
})

describe('transformAssetResponse', () => {
    test('transforms collectible asset with full collectible data', () => {
        const collectibleData = createCollectibleResponse()
        const input = createAssetResponse({
            asset_id: 99999,
            name: 'Cool NFT #42',
            type: 'collectible',
            collectible: collectibleData,
            fraction_decimals: 0,
            total: '1',
        })
        const result = transformAssetResponse(input)

        expect(result.assetId).toBe('99999')
        expect(result.peraMetadata?.type).toBe('collectible')
        expect(result.peraMetadata?.collectible).toBeDefined()
        expect(result.peraMetadata?.collectible?.title).toBe('Cool NFT #42')
        expect(result.peraMetadata?.collectible?.mediaType).toBe('image')
        expect(result.peraMetadata?.collectible?.collection?.name).toBe(
            'Cool Collection',
        )
        expect(result.peraMetadata?.collectible?.traits).toHaveLength(2)
        expect(result.peraMetadata?.collectible?.media).toHaveLength(1)
    })

    test('leaves collectible undefined when API returns null', () => {
        const input = createAssetResponse({
            type: 'standard_asset',
            collectible: null,
        })
        const result = transformAssetResponse(input)

        expect(result.peraMetadata?.collectible).toBeUndefined()
    })

    test('leaves collectible undefined when API omits it', () => {
        const input = createAssetResponse()
        delete (input as any).collectible
        const result = transformAssetResponse(input)

        expect(result.peraMetadata?.collectible).toBeUndefined()
    })

    test('transforms totalSupply as Decimal', () => {
        const input = createAssetResponse({ total: '10000000000' })
        const result = transformAssetResponse(input)

        expect(result.totalSupply).toBeInstanceOf(Decimal)
        expect(result.totalSupply.toString()).toBe('10000000000')
    })
})

const createIndexerAssetResponse = (
    paramsOverrides: Partial<IndexerAssetResponse['asset']['params']> = {},
): IndexerAssetResponse => ({
    asset: {
        index: '31566704',
        params: {
            creator: 'CREATOR_ADDRESS',
            decimals: 6,
            // uint64 above 2^53 — real fnet assets have totals around this
            // order of magnitude; must round-trip through Decimal unrounded.
            total: '18446744073709551615',
            'unit-name': 'USDC',
            name: 'USD Coin',
            url: 'https://example.com/usdc.png',
            ...paramsOverrides,
        },
    },
    'current-round': 40000000,
})

describe('transformIndexerAssetResponse', () => {
    test('transforms all fields from the indexer response shape', () => {
        const result = transformIndexerAssetResponse(
            createIndexerAssetResponse(),
        )

        expect(result.assetId).toBe('31566704')
        expect(result.decimals).toBe(6)
        expect(result.unitName).toBe('USDC')
        expect(result.name).toBe('USD Coin')
        expect(result.totalSupply).toBeInstanceOf(Decimal)
        expect(result.totalSupply.toString()).toBe('18446744073709551615')
        expect(result.creator).toEqual({ address: 'CREATOR_ADDRESS' })
        expect(result.url).toBe('https://example.com/usdc.png')
    })

    test('preserves 0 decimals rather than silently defaulting it', () => {
        // decimals is a legitimate, common value for whole-unit assets, and
        // it is falsy. A `||`-based fallback here (instead of reading it
        // directly, or `??`) would silently replace 0 with something else
        // and scale every displayed amount for this asset off by a power of
        // ten.
        const result = transformIndexerAssetResponse(
            createIndexerAssetResponse({ decimals: 0 }),
        )

        expect(result.decimals).toBe(0)
    })

    test('builds assetId from the asset index, preserving an id above 2^53', () => {
        const bigId = '18446744073709551615' // 2^64 - 1
        const result = transformIndexerAssetResponse({
            asset: {
                index: bigId,
                params: {
                    creator: 'CREATOR_ADDRESS',
                    decimals: 2,
                    total: '1',
                    'unit-name': 'X',
                    name: 'X Coin',
                },
            },
            'current-round': 1,
        })

        expect(result.assetId).toBe(bigId)
    })
})
