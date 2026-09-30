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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PeraAssetVerificationTier } from '@perawallet/wallet-core-assets'
import { Networks } from '@perawallet/wallet-core-config'

const mocks = vi.hoisted(() => ({
    fetchAssetDetails: vi.fn(),
    fetchIndexerAssetDetails: vi.fn(),
    fetchPublicAssetDetails: vi.fn(),
    upsertNodeAssets: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<object>()),
    upsertNodeAssets: mocks.upsertNodeAssets,
}))

vi.mock('../api', async importOriginal => ({
    ...(await importOriginal<object>()),
    fetchAssetDetails: mocks.fetchAssetDetails,
    fetchIndexerAssetDetails: mocks.fetchIndexerAssetDetails,
    fetchPublicAssetDetails: mocks.fetchPublicAssetDetails,
}))

import {
    fetchAssetAuthorities,
    fetchAssetFromApis,
    fetchOnChainAsset,
} from '../details'

const ZERO_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'

describe('fetchAssetFromApis', () => {
    // Same asset id, two different chains: the Pera lane reports 6 decimals —
    // real TestNet USDC — while the real chain's own indexer reports 0. The
    // request layer no longer lets a Pera response reach a network with no
    // deployment at all, so this simulates that invariant breaking: if Pera's
    // value won here, displayUnitsToBaseUnits would build a transaction for
    // the wrong amount, and that transaction would succeed on chain.
    const peraDecimals = 6
    const indexerDecimals = 0

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.upsertNodeAssets.mockResolvedValue(undefined)

        mocks.fetchAssetDetails.mockResolvedValue({
            asset_id: 10458941,
            name: 'USDC',
            unit_name: 'USDC',
            fraction_decimals: peraDecimals,
            total: '1000000000000',
            is_deleted: false,
            verification_tier: 'verified',
            creator: { address: 'PERA_TESTNET_CREATOR' },
            category: null,
        })

        mocks.fetchIndexerAssetDetails.mockResolvedValue({
            asset: {
                index: 10458941,
                params: {
                    decimals: indexerDecimals,
                    'unit-name': 'FNT',
                    name: 'FnetThing',
                    total: 5_000_000,
                    creator: 'FNET_CHAIN_CREATOR',
                },
            },
        })

        // The public lane isn't relevant to chain-intrinsic precedence; reject
        // it so Promise.allSettled simply omits it from the merge.
        mocks.fetchPublicAssetDetails.mockRejectedValue(
            new Error('public API not relevant to this test'),
        )
    })

    it('pera metadata wins on testnet, preserving current behaviour', async () => {
        const asset = await fetchAssetFromApis('10458941', Networks.testnet)

        expect(asset.decimals).toBe(peraDecimals)
        expect(asset.name).toBe('USDC')
    })

    it('indexer wins on chain-intrinsics for a network with no Pera deployment', async () => {
        const asset = await fetchAssetFromApis('10458941', Networks.betanet)

        expect(asset.decimals).toBe(indexerDecimals)
        expect(asset.name).toBe('FnetThing')
        expect(asset.unitName).toBe('FNT')
        // creator is an object — toEqual, not toBe. The indexer lane's creator
        // ('FNET_CHAIN_CREATOR') must win over Pera's ('PERA_TESTNET_CREATOR').
        expect(asset.creator).toEqual({ address: 'FNET_CHAIN_CREATOR' })
        // totalSupply is a Decimal; compare via toString so a Pera-wins
        // regression (1000000000000, from the Pera fixture's total) is
        // distinguishable from the indexer's 5000000.
        expect(asset.totalSupply.toString()).toBe('5000000')
    })

    it('pera still supplies its own metadata on a network with no Pera deployment', async () => {
        const asset = await fetchAssetFromApis('10458941', Networks.betanet)

        expect(asset.peraMetadata?.verificationTier).toBe(
            PeraAssetVerificationTier.verified,
        )
    })

    it('keeps the pera device fields when the public lane also answers', async () => {
        mocks.fetchAssetDetails.mockResolvedValue({
            asset_id: 123,
            name: 'Pera Name',
            fraction_decimals: 6,
            total: '1000',
            is_deleted: false,
            verification_tier: 'verified',
            creator: { address: 'ADDR' },
            category: null,
            is_favorited: true,
            is_price_alert_enabled: true,
            logo: 'https://pera-logo.png',
        })
        mocks.fetchPublicAssetDetails.mockResolvedValue({
            asset_id: 123,
            name: 'Public Name',
            fraction_decimals: 6,
            total_supply: 1000,
            total_supply_as_str: '1000',
            is_deleted: false,
            verification_tier: 'verified',
            is_collectible: false,
            logo: 'https://public-logo.png',
        })

        const asset = await fetchAssetFromApis('123', Networks.mainnet)

        expect(asset.peraMetadata?.isFavorited).toBe(true)
        expect(asset.peraMetadata?.isPriceAlertEnabled).toBe(true)
        expect(asset.peraMetadata?.logo).toBe('https://pera-logo.png')
    })

    it('persists the chain-intrinsics half so the next read is DB-local', async () => {
        await fetchAssetFromApis('10458941', Networks.testnet)

        expect(mocks.upsertNodeAssets).toHaveBeenCalledTimes(1)
        const { items, network } = mocks.upsertNodeAssets.mock.calls[0][0]
        expect(items).toHaveLength(1)
        expect(items[0].assetId).toBe('10458941')
        expect(network).toBe(Networks.testnet)
    })

    it('does not persist a merge built only from defaults (every lane failed)', async () => {
        mocks.fetchAssetDetails.mockRejectedValue(new Error('down'))
        mocks.fetchIndexerAssetDetails.mockRejectedValue(new Error('down'))

        const asset = await fetchAssetFromApis('10458941', Networks.testnet)

        expect(asset.assetId).toBe('10458941')
        expect(mocks.upsertNodeAssets).not.toHaveBeenCalled()
    })

    it('still returns the merged asset when the persist itself fails', async () => {
        mocks.upsertNodeAssets.mockRejectedValue(new Error('db locked'))

        const asset = await fetchAssetFromApis('10458941', Networks.testnet)

        expect(asset.name).toBe('USDC')
    })
})

describe('fetchOnChainAsset', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns the indexer record with no Pera opinion merged in', async () => {
        mocks.fetchIndexerAssetDetails.mockResolvedValue({
            asset: {
                index: 55,
                params: {
                    decimals: 2,
                    'unit-name': 'CHN',
                    name: 'Chain Thing',
                    total: 100,
                    creator: 'CREATOR',
                },
            },
        })

        const asset = await fetchOnChainAsset('55', Networks.mainnet)

        expect(asset).toEqual(
            expect.objectContaining({
                assetId: '55',
                unitName: 'CHN',
                creator: { address: 'CREATOR' },
            }),
        )
        expect(asset.peraMetadata).toBeUndefined()
        expect(mocks.fetchAssetDetails).not.toHaveBeenCalled()
    })
})

describe('fetchAssetAuthorities', () => {
    const indexerResponse = (params: {
        freeze?: string
        clawback?: string
    }) => ({
        asset: {
            index: '123',
            params: {
                creator: 'CREATOR',
                decimals: 6,
                total: '1000',
                ...params,
            },
        },
        'current-round': 1,
    })

    it('reports both authorities when both addresses are present', async () => {
        mocks.fetchIndexerAssetDetails.mockResolvedValue(
            indexerResponse({ freeze: 'FREEZEADDR', clawback: 'CLAWADDR' }),
        )

        expect(await fetchAssetAuthorities('123', Networks.mainnet)).toEqual({
            hasFreeze: true,
            hasClawback: true,
            freezeAddress: 'FREEZEADDR',
            clawbackAddress: 'CLAWADDR',
        })
    })

    it('reports none when the addresses are absent', async () => {
        mocks.fetchIndexerAssetDetails.mockResolvedValue(indexerResponse({}))

        expect(await fetchAssetAuthorities('123', Networks.mainnet)).toEqual({
            hasFreeze: false,
            hasClawback: false,
            freezeAddress: null,
            clawbackAddress: null,
        })
    })

    it('treats the all-zero address as a cleared authority', async () => {
        mocks.fetchIndexerAssetDetails.mockResolvedValue(
            indexerResponse({ freeze: ZERO_ADDRESS, clawback: ZERO_ADDRESS }),
        )

        expect(await fetchAssetAuthorities('123', Networks.mainnet)).toEqual({
            hasFreeze: false,
            hasClawback: false,
            freezeAddress: null,
            clawbackAddress: null,
        })
    })

    it('still reports a normal address as an active authority', async () => {
        mocks.fetchIndexerAssetDetails.mockResolvedValue(
            indexerResponse({ freeze: 'FREEZEADDR' }),
        )

        const authorities = await fetchAssetAuthorities('123', Networks.mainnet)

        expect(authorities.hasFreeze).toBe(true)
        expect(authorities.freezeAddress).toBe('FREEZEADDR')
    })
})
