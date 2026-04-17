/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { Decimal } from 'decimal.js'
import { describe, it, expect } from 'vitest'
import {
    ALGO_ASSET,
    PeraAssetType,
    type PeraAsset,
    type PeraAssetVerificationTier,
} from '@perawallet/wallet-core-assets'
import { isSwappableAsset } from '../isSwappableAsset'

const makeAsset = (overrides: Partial<PeraAsset> = {}): PeraAsset => ({
    assetId: '100',
    decimals: 6,
    creator: { address: 'CREATOR' },
    totalSupply: new Decimal('1000000'),
    name: 'Test',
    unitName: 'TST',
    peraMetadata: {
        isDeleted: false,
        verificationTier: 'unverified',
        isFavorited: false,
        isPriceAlertEnabled: false,
    },
    ...overrides,
})

describe('isSwappableAsset', () => {
    it('returns false for undefined asset', () => {
        expect(isSwappableAsset(undefined)).toBe(false)
    })

    it('returns false for collectibles', () => {
        const asset = makeAsset({
            peraMetadata: {
                isDeleted: false,
                verificationTier: 'verified',
                isFavorited: false,
                isPriceAlertEnabled: false,
                type: PeraAssetType.collectible,
            },
        })
        expect(isSwappableAsset(asset)).toBe(false)
    })

    it('returns false for unverified assets with no eligible category', () => {
        const asset = makeAsset({
            peraMetadata: {
                isDeleted: false,
                verificationTier: 'unverified',
                isFavorited: false,
                isPriceAlertEnabled: false,
                category: 3, // POOL_TOKEN
            },
        })
        expect(isSwappableAsset(asset)).toBe(false)
    })

    it('returns true for unverified assets in the RUG_NINJA category', () => {
        const asset = makeAsset({
            peraMetadata: {
                isDeleted: false,
                verificationTier: 'unverified',
                isFavorited: false,
                isPriceAlertEnabled: false,
                category: 1,
            },
        })
        expect(isSwappableAsset(asset)).toBe(true)
    })

    it('returns true for verified assets', () => {
        const asset = makeAsset({
            peraMetadata: {
                isDeleted: false,
                verificationTier: 'verified',
                isFavorited: false,
                isPriceAlertEnabled: false,
            },
        })
        expect(isSwappableAsset(asset)).toBe(true)
    })

    it('returns true for trusted assets', () => {
        const asset = makeAsset({
            peraMetadata: {
                isDeleted: false,
                verificationTier: 'trusted' as PeraAssetVerificationTier,
                isFavorited: false,
                isPriceAlertEnabled: false,
            },
        })
        expect(isSwappableAsset(asset)).toBe(true)
    })

    it('returns false for suspicious assets', () => {
        const asset = makeAsset({
            peraMetadata: {
                isDeleted: false,
                verificationTier: 'suspicious',
                isFavorited: false,
                isPriceAlertEnabled: false,
            },
        })
        expect(isSwappableAsset(asset)).toBe(false)
    })

    it('returns true for the ALGO asset', () => {
        expect(isSwappableAsset(ALGO_ASSET)).toBe(true)
    })
})
