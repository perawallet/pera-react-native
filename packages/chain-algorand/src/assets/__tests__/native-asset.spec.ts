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
import { isNativeAsset } from '@perawallet/wallet-core-chain-contract'
import {
    PeraAssetType,
    PeraAssetVerificationTier,
    toWholeUnits,
} from '@perawallet/wallet-core-assets'
import { Decimal } from 'decimal.js'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandDescriptor, isAlgorandNativeAssetId } from '../../descriptor'
import { ALGORAND_NATIVE_ASSET } from '../native-asset'

describe('ALGORAND_NATIVE_ASSET', () => {
    it('is the descriptor native asset', () => {
        expect(
            isNativeAsset(
                {
                    chainId: ALGORAND_CHAIN_ID,
                    assetId: ALGORAND_NATIVE_ASSET.assetId,
                },
                algorandDescriptor,
            ),
        ).toBe(true)
        expect(ALGORAND_NATIVE_ASSET.unitName).toBe(
            algorandDescriptor.nativeAsset.symbol,
        )
        expect(ALGORAND_NATIVE_ASSET.name).toBe(
            algorandDescriptor.nativeAsset.name,
        )
        expect(ALGORAND_NATIVE_ASSET.decimals).toBe(
            algorandDescriptor.nativeAsset.decimals,
        )
    })

    it('carries the 10B ALGO total supply in microAlgos, not the 1000x-too-large figure', () => {
        expect(ALGORAND_NATIVE_ASSET.totalSupply.toFixed()).toBe(
            '10000000000000000',
        )
        expect(
            toWholeUnits(
                ALGORAND_NATIVE_ASSET.totalSupply,
                ALGORAND_NATIVE_ASSET,
            ),
        ).toStrictEqual(new Decimal('10000000000'))
    })

    it('is verified and classed as the native type', () => {
        expect(ALGORAND_NATIVE_ASSET.peraMetadata).toEqual(
            expect.objectContaining({
                verificationTier: PeraAssetVerificationTier.verified,
                type: PeraAssetType.algo,
            }),
        )
    })
})

describe('isAlgorandNativeAssetId', () => {
    it('matches only the descriptor native id', () => {
        expect(isAlgorandNativeAssetId(ALGORAND_NATIVE_ASSET.assetId)).toBe(
            true,
        )
        expect(isAlgorandNativeAssetId('31566704')).toBe(false)
        expect(isAlgorandNativeAssetId('')).toBe(false)
    })
})
