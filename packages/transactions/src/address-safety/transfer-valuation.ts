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
    isNativeAsset,
    type AssetRef,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import {
    assetsAdapterFor,
    fetchAndPersistPrices,
    getAssetPricesByIds,
    getAssetsByIds,
    PeraAssetVerificationTier,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { logger, type Optional } from '@perawallet/wallet-core-shared'
import type { TransferValuation } from './models'

export type TransferToValue = {
    assetRef: AssetRef
    /** Base units. */
    value: Decimal
    decimalsHint: Optional<number>
    isSignedByAccount: boolean
}

// Best effort: an asset whose metadata or price can't be had stays worthless.
const readAssets = async (
    refs: AssetRef[],
    scope: ChainScope,
): Promise<Map<string, PeraAsset>> => {
    const assetIds = refs.map(ref => ref.assetId)
    let assets = await getAssetsByIds({ assetIds, scope })
    const missing = refs.filter(
        ref => !assets.some(asset => asset.assetId === ref.assetId),
    )
    if (missing.length > 0) {
        try {
            await assetsAdapterFor(scope).syncAssets(missing, scope)
            assets = await getAssetsByIds({ assetIds, scope })
        } catch (error) {
            logger.warn('Could not sync counterparty transfer assets', {
                error,
            })
        }
    }
    return new Map(assets.map(asset => [asset.assetId, asset]))
}

const readPrices = async (
    assetIds: string[],
    scope: ChainScope,
): Promise<Map<string, Decimal>> => {
    let prices = await getAssetPricesByIds({ assetIds, scope })
    const missing = assetIds.filter(
        id => !prices.some(price => price.assetId === id),
    )
    if (missing.length > 0) {
        try {
            await fetchAndPersistPrices(missing, scope)
            prices = await getAssetPricesByIds({ assetIds, scope })
        } catch (error) {
            logger.warn('Could not price counterparty transfer assets', {
                error,
            })
        }
    }
    return new Map(prices.map(price => [price.assetId, price.usdPrice]))
}

export const valueTransfers = async (
    transfers: readonly TransferToValue[],
    scope: ChainScope,
): Promise<TransferValuation[]> => {
    const descriptor = getChainDescriptor(scope.chainId)
    const isNative = (transfer: TransferToValue) =>
        isNativeAsset(transfer.assetRef, descriptor)
    // A signed native send needs no lookups, so a history of plain payments
    // costs no asset or price requests.
    const needsLookup = transfers.filter(
        transfer => !(transfer.isSignedByAccount && isNative(transfer)),
    )
    const refs = [
        ...new Map(
            needsLookup.map(({ assetRef }) => [assetRef.assetId, assetRef]),
        ).values(),
    ]
    const [assets, prices] =
        refs.length > 0
            ? await Promise.all([
                  readAssets(refs, scope),
                  readPrices(
                      refs.map(ref => ref.assetId),
                      scope,
                  ),
              ])
            : [new Map<string, PeraAsset>(), new Map<string, Decimal>()]

    return transfers.map(transfer => {
        const { assetId } = transfer.assetRef
        const asset = assets.get(assetId)
        const tier = asset?.peraMetadata?.verificationTier
        return {
            value: transfer.value,
            decimals: transfer.decimalsHint ?? asset?.decimals,
            usdPrice: prices.get(assetId),
            isNative: isNative(transfer),
            isVerified: tier === PeraAssetVerificationTier.verified,
            isSuspicious:
                !isNative(transfer) &&
                tier === PeraAssetVerificationTier.suspicious,
            isSignedByAccount: transfer.isSignedByAccount,
        }
    })
}
