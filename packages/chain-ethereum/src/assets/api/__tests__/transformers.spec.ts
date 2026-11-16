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

import { describe, expect, it } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { evmNftItem, unknownAssetItem, unknownNftItem } from '../msw-handlers'
import {
    assetItemSchema,
    nftItemSchema,
    type AssetItemResponse,
    type NftItemResponse,
} from '../schema'
import {
    isDescribedNftItem,
    toAssetMetadata,
    toNftAsset,
    toNftHolding,
    toPriceRow,
} from '../transformers'
import { ETHEREUM } from '../../../__tests__/evm-chains'

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const USDC_CAIP19 = `eip155:1/erc20:${USDC.toLowerCase()}`
const usdc: AssetItemResponse = {
    asset_id: USDC_CAIP19,
    type: 'erc20',
    name: 'USD Coin',
    unit_name: 'USDC',
    fraction_decimals: 6,
    logo: 'https://pera.test/usdc.png',
    usd_value: '1.000100000000000000000000',
    last_24_hours_usd_price_change_percentage: 0.01,
    is_verified: true,
    verification_tier: 'verified',
    explorer_url: null,
}

const item = (response: AssetItemResponse) => assetItemSchema.parse(response)

describe('toAssetMetadata', () => {
    it('maps an item to a PeraAsset under the requested app id', () => {
        const { assetId, asset, isQuarantined } = toAssetMetadata(
            USDC,
            item(usdc),
        )

        expect(assetId).toBe(USDC)
        expect(asset).toMatchObject({
            assetId: USDC,
            name: 'USD Coin',
            unitName: 'USDC',
            decimals: 6,
            creator: { address: '' },
            peraMetadata: {
                verificationTier: 'verified',
                logo: 'https://pera.test/usdc.png',
                type: 'standard_asset',
            },
        })
        expect(asset!.totalSupply.toFixed()).toBe('0')
        expect(isQuarantined).toBe(false)
    })

    it("keeps the backend's total supply in base units", () => {
        const { asset } = toAssetMetadata(
            USDC,
            item({ ...usdc, total: '61234567890000000' }),
        )

        expect(asset!.totalSupply.toFixed()).toBe('61234567890000000')
    })

    it('reads a null total as an unknown supply', () => {
        const { asset } = toAssetMetadata(USDC, item({ ...usdc, total: null }))

        expect(asset!.totalSupply.toFixed()).toBe('0')
    })

    // upsertPeraAssets keeps the local favourite and price alert only when
    // the incoming value is absent.
    it('leaves the device-local flags unset', () => {
        const { asset } = toAssetMetadata(USDC, item(usdc))

        expect(asset!.peraMetadata).not.toHaveProperty('isFavorited')
        expect(asset!.peraMetadata).not.toHaveProperty('isPriceAlertEnabled')
    })

    it("carries the item's cross-chain group, and leaves it unread when the item has none", () => {
        const group = { id: 'usdc', name: 'USD Coin', symbol: 'USDC' }

        const grouped = toAssetMetadata(
            USDC,
            item({ ...usdc, cross_chain_asset_group: group }),
        )
        const ungrouped = toAssetMetadata(
            USDC,
            item({ ...usdc, cross_chain_asset_group: null }),
        )
        const unread = toAssetMetadata(USDC, item(usdc))

        expect(grouped.asset!.peraMetadata?.crossChainAssetGroup).toEqual(group)
        expect(ungrouped.asset!.peraMetadata?.crossChainAssetGroup).toBeNull()
        expect(unread.asset!.peraMetadata?.crossChainAssetGroup).toBeUndefined()
    })

    it('reports a suspicious item with no metadata as quarantined', () => {
        expect(
            toAssetMetadata(
                USDC,
                item({
                    ...unknownAssetItem(USDC_CAIP19),
                    verification_tier: 'suspicious',
                }),
            ),
        ).toEqual({ assetId: USDC, asset: null, isQuarantined: true })
    })

    it('reports an item with no decimals as unknown', () => {
        expect(
            toAssetMetadata(USDC, item({ ...usdc, fraction_decimals: null })),
        ).toEqual({ assetId: USDC, asset: null, isQuarantined: false })
    })
})

describe('toPriceRow', () => {
    it('keeps every digit of the USD value', () => {
        const row = toPriceRow(USDC, item(usdc))

        expect(row?.assetId).toBe(USDC)
        expect(row?.usdPrice.toFixed()).toBe('1.0001')
    })

    it('reports no price as a miss, never zero', () => {
        expect(toPriceRow(USDC, item({ ...usdc, usd_value: null }))).toBeNull()
    })
})

const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const BAYC = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'
const nft = (overrides: Partial<NftItemResponse> = {}) =>
    nftItemSchema.parse(evmNftItem(overrides))

describe('toNftAsset', () => {
    it('maps an ERC-721 to a unique collectible under its contract/token id', () => {
        const asset = toNftAsset(nft(), MAINNET, ETHEREUM)

        expect(asset).toMatchObject({
            assetId: `${BAYC}/1234`,
            name: 'Bored Ape #1234',
            unitName: 'BAYC',
            decimals: 0,
            creator: { address: BAYC },
            peraMetadata: {
                type: 'collectible',
                isUnique: true,
                verificationTier: 'verified',
                logo: 'https://nft.pera.test/bayc/1234-preview.png',
                collectible: {
                    title: 'Bored Ape #1234',
                    standard: 'erc721',
                    primaryImage: 'https://nft.pera.test/bayc/1234-preview.png',
                    mediaType: 'image',
                    collection: { name: 'Bored Ape Yacht Club' },
                    traits: [
                        { displayName: 'Background', displayValue: 'Orange' },
                    ],
                    media: [
                        {
                            type: 'image',
                            downloadUrl: 'https://nft.pera.test/bayc/1234.png',
                            previewUrl:
                                'https://nft.pera.test/bayc/1234-preview.png',
                            extension: 'png',
                        },
                    ],
                },
            },
        })
    })

    it('marks an ERC-1155 as not unique', () => {
        const asset = toNftAsset(
            nft({
                asset_id: `eip155:1/erc1155:${BAYC.toLowerCase()}/7`,
                standard: 'erc1155',
            }),
            MAINNET,
            ETHEREUM,
        )

        expect(asset?.assetId).toBe(`${BAYC}/7`)
        expect(asset?.peraMetadata?.isUnique).toBe(false)
    })

    it.each([
        ['an SVG data URL', 'data:image/svg+xml,<svg onload="x()"/>'],
        [
            'an IPFS link',
            'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        ],
        ['a script URL', 'javascript:alert(1)'],
        ['plain http', 'http://nft.pera.test/1234.png'],
    ])('drops %s from the image and media but keeps the token', (_, url) => {
        const asset = toNftAsset(
            nft({
                primary_image: { url, preview_url: url },
                media: [{ url, preview_url: url, mime_type: null }],
                explorer_url: url,
            }),
            MAINNET,
            ETHEREUM,
        )

        expect(asset?.assetId).toBe(`${BAYC}/1234`)
        expect(asset?.peraMetadata?.collectible?.primaryImage).toBeUndefined()
        expect(asset?.peraMetadata?.collectible?.media).toEqual([])
        expect(asset?.peraMetadata?.collectible?.explorerUrl).toBeUndefined()
        expect(asset?.peraMetadata?.logo).toBeNull()
    })

    it("refuses an id that isn't an NFT on the scope's chain", () => {
        expect(
            toNftAsset(
                nft({ asset_id: `eip155:137/erc721:${BAYC}/1` }),
                MAINNET,
                ETHEREUM,
            ),
        ).toBeNull()
        expect(
            toNftAsset(
                nft({ asset_id: `eip155:1/erc20:${BAYC.toLowerCase()}` }),
                MAINNET,
                ETHEREUM,
            ),
        ).toBeNull()
    })
})

describe('toNftHolding', () => {
    it('holds the listed quantity of an ERC-1155', () => {
        const holding = toNftHolding(
            nft({
                asset_id: `eip155:1/erc1155:${BAYC.toLowerCase()}/7`,
                standard: 'erc1155',
                balance: '3',
            }),
            MAINNET,
            ETHEREUM,
        )

        expect(holding?.amount.toFixed()).toBe('3')
        expect(holding?.asset.assetId).toBe(`${BAYC}/7`)
    })

    it.each([
        ['a zero balance', '0'],
        ['a null balance', null],
    ])('is no holding with %s', (_, balance) => {
        expect(toNftHolding(nft({ balance }), MAINNET, ETHEREUM)).toBeNull()
    })
})

describe('nftItemSchema', () => {
    it('reads the backend item as documented', () => {
        const parsed = nftItemSchema.parse(evmNftItem())

        expect(parsed.traits).toEqual([
            { trait_type: 'Background', value: 'Orange' },
        ])
        expect(parsed.media).toHaveLength(1)
    })

    it('reads a missing preview_url as null and a null balance as no balance', () => {
        const parsed = nftItemSchema.parse({
            ...evmNftItem({ balance: null }),
            primary_image: { url: 'https://nft.pera.test/1.png' },
        })

        expect(parsed.primary_image).toEqual({
            url: 'https://nft.pera.test/1.png',
            preview_url: null,
        })
        expect(parsed.balance).toBeNull()
    })

    it('drops one unreadable trait or media entry without the item', () => {
        const parsed = nftItemSchema.parse({
            ...evmNftItem(),
            traits: [
                { trait_type: 'Good', value: 7 },
                { trait_type: 'Bad', value: { nested: true } },
            ],
            media: [
                { url: 'https://nft.pera.test/a.png' },
                { url: 5 },
                { url: 'ipfs://x' },
            ],
        })

        expect(parsed.traits).toEqual([{ trait_type: 'Good', value: '7' }])
        expect(parsed.media.map(entry => entry.url)).toEqual([
            'https://nft.pera.test/a.png',
        ])
    })
})

describe('toNftAsset media', () => {
    const mediaOf = (overrides: Partial<NftItemResponse>) =>
        toNftAsset(nft(overrides), MAINNET, ETHEREUM)?.peraMetadata?.collectible
            ?.media

    it.each([
        ['video/mp4', 'video', 'mp4'],
        ['audio/mpeg', 'audio', 'mpeg'],
        ['model/gltf-binary', 'model', 'gltf-binary'],
        ['image/webp', 'image', 'webp'],
    ])('types %s as %s with extension %s', (mime, type, extension) => {
        const media = mediaOf({
            media: [
                {
                    url: 'https://nft.pera.test/other',
                    preview_url: null,
                    mime_type: mime,
                },
            ],
        })

        expect(media).toMatchObject([{ type, extension }])
    })

    it('reads an untyped entry as an image only at the primary image, with the URL extension', () => {
        const media = mediaOf({
            primary_image: {
                url: 'https://nft.pera.test/1.PNG',
                preview_url: null,
            },
            media: [
                {
                    url: 'https://nft.pera.test/1.PNG',
                    preview_url: null,
                    mime_type: null,
                },
                {
                    url: 'https://nft.pera.test/other',
                    preview_url: null,
                    mime_type: null,
                },
            ],
        })

        expect(media).toMatchObject([
            { type: 'image', extension: 'png' },
            { type: 'unknown', extension: '' },
        ])
    })

    it('shows the primary image itself when the preview is null', () => {
        const asset = toNftAsset(
            nft({
                primary_image: {
                    url: 'https://nft.pera.test/1.png',
                    preview_url: null,
                },
            }),
            MAINNET,
            ETHEREUM,
        )

        expect(asset?.peraMetadata?.collectible?.primaryImage).toBe(
            'https://nft.pera.test/1.png',
        )
    })
})

describe('isDescribedNftItem', () => {
    it('is false for the blank answer to an unknown token, true once anything is known', () => {
        const id = `eip155:1/erc721:${BAYC.toLowerCase()}/9`

        expect(
            isDescribedNftItem(nftItemSchema.parse(unknownNftItem(id))),
        ).toBe(false)
        expect(isDescribedNftItem(nft())).toBe(true)
        expect(
            isDescribedNftItem(
                nftItemSchema.parse({
                    ...unknownNftItem(id),
                    traits: [{ trait_type: 'a', value: 'b' }],
                }),
            ),
        ).toBe(true)
    })
})
