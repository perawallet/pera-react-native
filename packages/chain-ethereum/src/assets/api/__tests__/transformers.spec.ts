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
import { evmNftItem, unknownAssetItem } from '../msw-handlers'
import {
    assetItemSchema,
    nftItemSchema,
    type AssetItemResponse,
    type NftItemResponse,
} from '../schema'
import {
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
                media: [
                    { type: 'image', url, preview_url: url, mime_type: null },
                ],
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
        ['no balance', undefined],
    ])('is no holding with %s', (_, balance) => {
        expect(toNftHolding(nft({ balance }), MAINNET, ETHEREUM)).toBeNull()
    })
})
