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
import type { Decimal } from 'decimal.js'
import {
    toWholeUnits,
    useSingleAssetDetailsQuery,
    type DisplayableAsset,
} from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { imitatedCurrencyOf } from '@perawallet/wallet-core-currencies'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { AssetInboxRequest } from '@perawallet/wallet-core-transactions'
import { useResolvedAddress } from '@hooks/useResolvedAddress'

export type UseAssetTransferRequestItemResult = {
    /** The inbox payload's asset, with the full details' facts when they have loaded. */
    resolvedAsset: DisplayableAsset
    senderDisplayName: string
    /** Display units. */
    amount: Decimal
    /** Code the asset's unit name imitates (the chain's native ticker or a fiat code), or null. */
    imitatedCurrency: Nullable<string>
}

export const useAssetTransferRequestItem = (
    item: AssetInboxRequest,
    scope: ChainScope,
): UseAssetTransferRequestItemResult => {
    const { asset, senders, totalAmount } = item
    const { data: fullAsset } = useSingleAssetDetailsQuery(asset.assetId, scope)
    const resolvedAsset = useMemo(() => {
        if (!fullAsset) return asset
        return {
            ...fullAsset,
            peraMetadata: {
                ...fullAsset.peraMetadata,
                logo: fullAsset.peraMetadata?.logo ?? asset.peraMetadata?.logo,
                collectible:
                    fullAsset.peraMetadata?.collectible ??
                    asset.peraMetadata?.collectible,
            },
        }
    }, [fullAsset, asset])

    const firstSender = senders.results[0]
    const { displayName: senderDisplayName } = useResolvedAddress(
        firstSender?.sender.address ?? '',
        scope,
        { enabled: !!firstSender?.sender.address && !firstSender?.sender.name },
    )

    const amount = useMemo(
        () => toWholeUnits(totalAmount, asset),
        [totalAmount, asset],
    )

    const imitatedCurrency = useMemo(
        () =>
            imitatedCurrencyOf(
                { chainId: scope.chainId, assetId: asset.assetId },
                asset.unitName,
            ),
        [scope.chainId, asset.assetId, asset.unitName],
    )

    return { resolvedAsset, senderDisplayName, amount, imitatedCurrency }
}
