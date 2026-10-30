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
import {
    isCollectible,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import type { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { CollectibleDisplayItem } from '../../types/collectible'

export type UseAccountAssetItemViewProps = {
    accountBalance: AssetWithAccountBalance
    skipFetch: boolean
    scope: ChainScope
}

export type UseAccountAssetItemViewResult = {
    asset: AssetWithAccountBalance['asset']
    item: Nullable<CollectibleDisplayItem>
}

export const useAccountAssetItemView = ({
    accountBalance,
    skipFetch,
    scope,
}: UseAccountAssetItemViewProps): UseAccountAssetItemViewResult => {
    // Use pre-fetched asset data when available to avoid N+1 queries.
    // Falls back to individual fetch for callers that don't populate
    // accountBalance.asset. The main asset list passes skipFetch so all
    // rows share a single empty-array query and don't create a separate
    // RQ observer per row, which would saturate the JS thread on large
    // watch accounts.
    const assetIds = useMemo(
        () =>
            skipFetch || accountBalance.asset ? [] : [accountBalance.assetId],
        [skipFetch, accountBalance.asset, accountBalance.assetId],
    )
    const { data: fetchedAssets } = useAssetsQuery(scope, assetIds)

    const asset = useMemo(() => {
        return (
            fetchedAssets?.get(accountBalance.assetId) ?? accountBalance.asset
        )
    }, [accountBalance.asset, fetchedAssets, accountBalance.assetId])

    const item = useMemo(() => {
        if (asset && isCollectible(asset)) {
            return {
                assetId: accountBalance.assetId,
                asset,
                collectible: asset.peraMetadata?.collectible,
                amount: accountBalance.amount,
            }
        }
        return null
    }, [asset, accountBalance])

    return { asset, item }
}
