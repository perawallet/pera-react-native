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

import { Decimal } from 'decimal.js'
import {
    DEFAULT_ASSET_METADATA,
    PeraAssetType,
    PeraAssetVerificationTier,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { algorandDescriptor } from '../descriptor'

const { nativeAsset } = algorandDescriptor

/** One module-level instance: memoised consumers compare it by identity. */
export const ALGORAND_NATIVE_ASSET: PeraAsset = {
    assetId: nativeAsset.ref.assetId,
    name: nativeAsset.name,
    unitName: nativeAsset.symbol,
    decimals: nativeAsset.decimals,
    totalSupply: new Decimal('10000000000000000'), // 10B ALGO in microAlgos
    creator: {
        address: '',
    },
    peraMetadata: {
        ...DEFAULT_ASSET_METADATA,
        verificationTier: PeraAssetVerificationTier.verified,
        type: PeraAssetType.algo,
    },
}
