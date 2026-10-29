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

import { useHeldAssetDetailsQuery } from '@perawallet/wallet-core-accounts'
import {
    PeraAssetVerificationTier,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { WidgetAssetOption } from '../snapshot'

export type UseWidgetAssetOptionsQueryResult = {
    /** `undefined` while loading or disabled. */
    options: WidgetAssetOption[] | undefined
}

// Keeps the Edit Widget list usable and the snapshot small.
const MAX_ASSET_OPTIONS = 50
const NATIVE_ASSET_ID = '0'

// Only verified assets: a home-screen price for a look-alike "USDC" would be
// a phishing surface. The widget re-checks the tier on every fetch.
const toOption = (asset: PeraAsset): WidgetAssetOption | undefined => {
    const metadata = asset.peraMetadata
    if (metadata?.verificationTier !== PeraAssetVerificationTier.verified) {
        return undefined
    }
    if (metadata.collectible) return undefined
    return {
        assetId: asset.assetId,
        name: asset.name ?? asset.assetId,
        unitName: asset.unitName ?? asset.assetId,
    }
}

export const useWidgetAssetOptionsQuery = (
    addresses: string[],
    scope: ChainScope,
    enabled: boolean,
): UseWidgetAssetOptionsQueryResult => {
    const { assets, isError } = useHeldAssetDetailsQuery(addresses, scope, {
        kind: 'fungible',
        enabled,
    })
    if (!enabled) return { options: undefined }
    // A failed or empty read leaves only ALGO in the picker rather than
    // holding back the snapshot.
    if (addresses.length === 0 || isError) return { options: [] }
    return {
        options: assets
            // ALGO is always offered by the widget itself.
            ?.filter(asset => asset.assetId !== NATIVE_ASSET_ID)
            .map(toOption)
            .filter((option): option is WidgetAssetOption => !!option)
            .slice(0, MAX_ASSET_OPTIONS),
    }
}
