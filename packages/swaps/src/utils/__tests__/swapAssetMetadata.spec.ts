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

import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { SwapAsset } from '../../models'
import {
    peraAssetFromSwapAsset,
    swapAssetTierOf,
    withSwapAssetLogo,
} from '../swapAssetMetadata'

const swapAsset = (overrides: Partial<SwapAsset> = {}): SwapAsset => ({
    ref: { chainId: 'base', networkId: 'mainnet', assetId: '0xUSDC' },
    assetId: '0xUSDC',
    name: 'USD Coin',
    unitName: 'USDC',
    decimals: 6,
    logo: 'https://logo/usdc.png',
    verificationTier: 'verified',
    crossChainAssetGroup: null,
    ...overrides,
})

const stored = (peraMetadata?: PeraAsset['peraMetadata']): PeraAsset => ({
    assetId: '0xUSDC',
    decimals: 6,
    creator: { address: '' },
    totalSupply: new Decimal(0),
    name: 'USD Coin',
    unitName: 'USDC',
    peraMetadata,
})

describe('swapAssetTierOf', () => {
    it.each([
        ['verified', 'verified'],
        ['suspicious', 'suspicious'],
        ['trusted', 'unverified'],
    ])('reads a router tier of %s as %s', (verificationTier, expected) => {
        expect(swapAssetTierOf({ verificationTier })).toBe(expected)
    })
})

describe('peraAssetFromSwapAsset', () => {
    it("carries the router's name, decimals, logo and tier", () => {
        const asset = peraAssetFromSwapAsset(swapAsset())

        expect(asset).toMatchObject({
            assetId: '0xUSDC',
            name: 'USD Coin',
            unitName: 'USDC',
            decimals: 6,
            peraMetadata: {
                verificationTier: 'verified',
                logo: 'https://logo/usdc.png',
            },
        })
    })
})

describe('withSwapAssetLogo', () => {
    it("adds the router's logo to a row stored without one", () => {
        const asset = withSwapAssetLogo(stored(), swapAsset())

        expect(asset.peraMetadata).toEqual({
            isDeleted: false,
            verificationTier: 'verified',
            logo: 'https://logo/usdc.png',
        })
    })

    it("keeps the stored tier over the router's", () => {
        const asset = withSwapAssetLogo(
            stored({ isDeleted: false, verificationTier: 'suspicious' }),
            swapAsset(),
        )

        expect(asset.peraMetadata?.verificationTier).toBe('suspicious')
        expect(asset.peraMetadata?.logo).toBe('https://logo/usdc.png')
    })

    it.each([
        [
            'already has a logo',
            stored({
                isDeleted: false,
                verificationTier: 'verified',
                logo: 'https://logo/stored.png',
            }),
            swapAsset(),
        ],
        [
            'meets a router asset with no logo',
            stored(),
            swapAsset({ logo: undefined }),
        ],
    ])('returns the same row when it %s', (_name, asset, routerAsset) => {
        expect(withSwapAssetLogo(asset, routerAsset)).toBe(asset)
    })
})
