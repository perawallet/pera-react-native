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

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { SwapAsset } from '@perawallet/wallet-core-swaps'
import { swapAssetIconSource } from '../swapAssetIconSource'

const swapAsset: SwapAsset = {
    assetId: '0xabc',
    ref: { chainId: 'ethereum', networkId: 'mainnet', assetId: '0xabc' },
    name: 'USD Coin',
    unitName: 'USDC',
    decimals: 6,
    logo: 'https://cdn/usdc.png',
    verificationTier: 'verified',
    crossChainAssetGroup: null,
}

const stored = (logo?: string): PeraAsset => ({
    assetId: '0xabc',
    decimals: 6,
    creator: { address: '' },
    totalSupply: new Decimal(0),
    peraMetadata: {
        isDeleted: false,
        verificationTier: 'verified',
        logo,
    },
})

describe('swapAssetIconSource', () => {
    it('uses the stored asset and its own logo when it has one', () => {
        const asset = stored('https://pera/usdc.png')

        const source = swapAssetIconSource(asset, swapAsset)

        expect(source.asset).toBe(asset)
        expect(source.logoUrl).toBeUndefined()
    })

    it("falls back to the router's logo when the stored asset has none", () => {
        const asset = stored()

        const source = swapAssetIconSource(asset, swapAsset)

        expect(source.asset).toBe(asset)
        expect(source.logoUrl).toBe('https://cdn/usdc.png')
    })

    it('builds the asset from the router payload when nothing is stored', () => {
        const source = swapAssetIconSource(undefined, swapAsset)

        expect(source.asset).toMatchObject({
            assetId: '0xabc',
            peraMetadata: { logo: 'https://cdn/usdc.png' },
        })
    })
})
