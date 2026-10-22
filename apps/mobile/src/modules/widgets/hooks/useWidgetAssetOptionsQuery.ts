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

import { useQuery } from '@tanstack/react-query'
import { getAccountHoldingsLite } from '@perawallet/wallet-core-accounts'
import {
    getAssetsByIds,
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

const loadOptions = async (
    addresses: string[],
    scope: ChainScope,
): Promise<WidgetAssetOption[]> => {
    const rows = await Promise.all(
        addresses.map(address =>
            getAccountHoldingsLite({
                sources: [{ address, scope }],
                hideZeroBalance: true,
                hideNfts: true,
            }),
        ),
    )
    // ALGO is always offered by the widget itself.
    const assetIds = [...new Set(rows.flat().map(row => row.assetId))].filter(
        id => id !== NATIVE_ASSET_ID,
    )
    const assets = await getAssetsByIds({ assetIds, scope })
    return assets
        .map(toOption)
        .filter((option): option is WidgetAssetOption => !!option)
        .slice(0, MAX_ASSET_OPTIONS)
}

export const useWidgetAssetOptionsQuery = (
    addresses: string[],
    scope: ChainScope,
    enabled: boolean,
): UseWidgetAssetOptionsQueryResult => {
    const sortedAddresses = [...addresses].sort()
    const hasAddresses = addresses.length > 0
    const { data, isError } = useQuery({
        queryKey: ['widgets', 'asset-options', scope, sortedAddresses],
        queryFn: () => loadOptions(sortedAddresses, scope),
        enabled: enabled && hasAddresses,
        // Local SQLite reads; must not pause offline.
        networkMode: 'always',
    })
    if (!enabled) return { options: undefined }
    // A failed or empty read leaves only ALGO in the picker rather than
    // holding back the snapshot.
    if (!hasAddresses || isError) return { options: [] }
    return { options: data }
}
