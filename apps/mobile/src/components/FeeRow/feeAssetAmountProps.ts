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

import type { Decimal } from 'decimal.js'
import {
    nativeAssetFor,
    toWholeUnits,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { AssetAmountProps } from '@components/AssetAmount'

export type FeeAssetAmountProps = Pick<
    AssetAmountProps,
    'chainId' | 'density' | 'symbolPosition' | 'ignorePrivacyMode'
> & {
    asset: PeraAsset
    value: Decimal
}

/**
 * `amount` is in base units of the scope's native asset. Every place that shows
 * a fee spreads this, so no two of them round the same fee differently.
 */
export const feeAssetAmountPropsOf = (
    scope: ChainScope,
    amount: Decimal,
): FeeAssetAmountProps => {
    const asset = nativeAssetFor(scope.chainId)
    return {
        chainId: scope.chainId,
        asset,
        value: toWholeUnits(amount, asset),
        density: 'significant',
        symbolPosition: 'end',
        ignorePrivacyMode: true,
    }
}
