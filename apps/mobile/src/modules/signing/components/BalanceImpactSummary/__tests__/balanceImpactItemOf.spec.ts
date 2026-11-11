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
import { Decimal } from 'decimal.js'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { balanceImpactItemOf } from '../balanceImpactItemOf'

const USDC: PeraAsset = {
    assetId: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    unitName: 'USDC',
    decimals: 6,
    creator: { address: '' },
    totalSupply: new Decimal(0),
}

const NFT: PeraAsset = {
    assetId: '0x1111111111111111111111111111111111111111/7',
    name: 'Cool Cat',
    decimals: 0,
    creator: { address: '' },
    totalSupply: new Decimal(1),
    peraMetadata: {
        isDeleted: false,
        verificationTier: 'verified',
        type: 'collectible',
        collectible: {
            title: 'Cool Cat #7',
            collection: { name: 'Cool Cats' },
        },
        isUnique: true,
    },
}

describe('balanceImpactItemOf', () => {
    it('reads a positive amount as a receive, in display units', () => {
        const item = balanceImpactItemOf({
            assetId: USDC.assetId,
            chainId: 'ethereum',
            asset: USDC,
            baseUnits: new Decimal('2282960'),
            usdPrice: new Decimal('1'),
        })

        expect(item).toMatchObject({
            direction: 'receive',
            amount: new Decimal('2.28296'),
            usdPrice: new Decimal('1'),
            isCollectible: false,
            isNewAsset: false,
            isFullBalance: false,
        })
    })

    it('reads a negative bigint as a spend of its absolute amount', () => {
        const item = balanceImpactItemOf({
            assetId: USDC.assetId,
            chainId: 'ethereum',
            asset: USDC,
            baseUnits: -1_000_000n,
        })

        expect(item).toMatchObject({
            direction: 'spend',
            amount: new Decimal(1),
        })
    })

    it('reads zero as a spend, as a close-only sweep needs', () => {
        expect(
            balanceImpactItemOf({
                assetId: USDC.assetId,
                chainId: 'ethereum',
                asset: USDC,
                baseUnits: 0n,
                isFullBalance: true,
            }),
        ).toMatchObject({ direction: 'spend', isFullBalance: true })
    })

    it('shows the id as the unit while the asset record is unread', () => {
        const item = balanceImpactItemOf({
            assetId: USDC.assetId,
            chainId: 'ethereum',
            asset: undefined,
            baseUnits: new Decimal(5),
        })

        expect(item.asset).toEqual({
            assetId: USDC.assetId,
            unitName: USDC.assetId,
        })
        expect(item.amount).toEqual(new Decimal(5))
    })

    it('names an NFT with no record from the fallback, as a collectible', () => {
        const item = balanceImpactItemOf({
            assetId: NFT.assetId,
            chainId: 'ethereum',
            asset: undefined,
            baseUnits: new Decimal(1),
            collectibleFallback: {
                title: 'Uniswap V3 Positions',
                subtitle: '#7',
            },
        })

        expect(item).toMatchObject({
            isCollectible: true,
            isPureCollectible: true,
            collectibleTitle: 'Uniswap V3 Positions',
            collectibleSubtitle: '#7',
            direction: 'receive',
        })
    })

    it('ignores the fallback once the asset has a record', () => {
        const item = balanceImpactItemOf({
            assetId: USDC.assetId,
            chainId: 'ethereum',
            asset: USDC,
            baseUnits: new Decimal(1),
            collectibleFallback: {
                title: 'Uniswap V3 Positions',
                subtitle: '#7',
            },
        })

        expect(item).toMatchObject({
            isCollectible: false,
            isPureCollectible: false,
        })
        expect(item.collectibleTitle).toBeUndefined()
    })

    it('titles a collectible from its metadata and names its collection', () => {
        const item = balanceImpactItemOf({
            assetId: NFT.assetId,
            chainId: 'ethereum',
            asset: NFT,
            baseUnits: new Decimal(-1),
        })

        expect(item).toMatchObject({
            isCollectible: true,
            collectibleTitle: 'Cool Cat #7',
            collectibleSubtitle: `Cool Cats · ${NFT.assetId}`,
            direction: 'spend',
        })
    })
})
