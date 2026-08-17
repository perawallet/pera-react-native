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

import { useMemo } from 'react'
import { Decimal } from 'decimal.js'
import {
    DEFAULT_ASSET_METADATA,
    PeraAssetVerificationTier,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { AccountAssetItemView } from '@modules/assets/components'

import type { DexSwapAsset } from '@perawallet/wallet-core-swaps'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { PWTouchableOpacityProps } from '@components/core'

const VERIFICATION_TIERS = new Set<string>(
    Object.values(PeraAssetVerificationTier),
)

const isVerificationTier = (
    value: unknown,
): value is PeraAssetVerificationTier =>
    typeof value === 'string' && VERIFICATION_TIERS.has(value)

export type SwapToAssetItemViewProps = {
    dexAsset: DexSwapAsset
    balance: Nullable<Decimal>
} & PWTouchableOpacityProps

export const SwapToAssetItemView = ({
    dexAsset,
    balance,
    ...rest
}: SwapToAssetItemViewProps) => {
    const accountBalance = useMemo<AssetWithAccountBalance>(() => {
        const asset: PeraAsset = {
            assetId: dexAsset.assetId,
            name: dexAsset.name,
            unitName: dexAsset.unitName,
            decimals: dexAsset.decimals ?? 0,
            creator: { address: '' },
            totalSupply: dexAsset.total
                ? new Decimal(dexAsset.total)
                : new Decimal(0),
            peraMetadata: {
                ...DEFAULT_ASSET_METADATA,
                verificationTier: isVerificationTier(dexAsset.verificationTier)
                    ? dexAsset.verificationTier
                    : DEFAULT_ASSET_METADATA.verificationTier,
            },
        }

        return {
            assetId: dexAsset.assetId,
            asset,
            amount: balance ?? new Decimal(0),
            algoValue: new Decimal(0),
            isFrozen: false,
        }
    }, [dexAsset, balance])

    return (
        <AccountAssetItemView
            accountBalance={accountBalance}
            logoUrl={dexAsset.logo}
            showBalance={balance !== null}
            {...rest}
        />
    )
}
