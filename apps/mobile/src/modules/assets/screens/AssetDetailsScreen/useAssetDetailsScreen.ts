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

import { useEffect, useMemo } from 'react'
import {
    chainAccountOf,
    getAccountDisplayName,
    useAccountHoldingSources,
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    isCollectible as isCollectibleAsset,
    useAssetOnChainSupplyQuery,
    useSingleAssetDetailsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    isNativeAsset,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    getChainDescriptor,
    useChainCapability,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import {
    dedupeSecondaryLabel,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { trackEvent, AssetDetailsEvent, AnalyticsMetadataKey } from '@analytics'
import { useResolvedAddress } from '@hooks/useResolvedAddress'
import { chainUiFor } from '@modules/chain-ui'
import type {
    AssetAboutDisplay,
    AssetDetailsDisplay,
    AssetDisplayParams,
    AssetSupplyDisplay,
} from '../../types/asset-details-display'
import { neutralAssetDetailsDisplay } from './neutralAssetDetailsDisplay'

export type UseAssetDetailsScreenParams = {
    assetId: string
    chainId: ChainId
    isCollectible: boolean
}

export type UseAssetDetailsScreenResult = {
    account: Nullable<WalletAccount>
    asset: Optional<PeraAsset>
    scope: ChainScope
    isLoading: boolean
    isError: boolean
    headerPrimary: string
    headerSecondary: Optional<string>
    assetDetailsDisplay: AssetDetailsDisplay
    about: Nullable<AssetAboutDisplay>
    supply: Nullable<AssetSupplyDisplay>
    isNetworkLineVisible: boolean
    isMarketsTabVisible: boolean
}

export const useAssetDetailsScreen = ({
    assetId,
    chainId,
    isCollectible,
}: UseAssetDetailsScreenParams): UseAssetDetailsScreenResult => {
    const account = useSelectedAccount()
    const scope = useSelectedScope(chainId)
    const {
        data: asset,
        isPending,
        isError: isQueryError,
    } = useSingleAssetDetailsQuery(assetId, scope)
    // A failed background refetch keeps the loaded asset; only a load that never produced one is an error.
    const isError = isQueryError && !asset
    const descriptor = getChainDescriptor(chainId)
    const assetDetailsDisplay =
        chainUiFor(descriptor.family).assetDetails ?? neutralAssetDetailsDisplay

    const isNative = isNativeAsset({ chainId, assetId }, descriptor)
    // Sync stores a zero supply for a token whose source carried none; one
    // chain read for the asset on screen fills it. A collectible stores zero
    // too, and a chain can't read it as a token.
    const { totalSupply: onChainSupply } = useAssetOnChainSupplyQuery(
        assetId,
        scope,
        !!asset &&
            !isNative &&
            !isCollectible &&
            !isCollectibleAsset(asset) &&
            asset.totalSupply.isZero(),
    )

    const { about, supply } = useMemo(() => {
        if (!asset) {
            return { about: null, supply: null }
        }
        const params: AssetDisplayParams = {
            asset,
            scope,
            descriptor,
            isNativeAsset: isNative,
        }
        return {
            about: assetDetailsDisplay.resolveAbout(params),
            supply: assetDetailsDisplay.resolveSupply(
                onChainSupply
                    ? {
                          ...params,
                          asset: { ...asset, totalSupply: onChainSupply },
                      }
                    : params,
            ),
        }
    }, [asset, assetDetailsDisplay, scope, descriptor, isNative, onChainSupply])

    // The same test Home uses for its chain badges, so both screens agree on when a chain needs naming.
    const isNetworkLineVisible = useAccountHoldingSources(account).length > 1
    // Market data comes from the chain's pricing; without it the tab would only ever be empty.
    const isMarketsTabVisible = useChainCapability(chainId, 'pricing')

    const address = account
        ? chainAccountOf(account, chainId)?.address
        : undefined
    const { displayName: accountDisplayName } = useResolvedAddress(
        address ?? '',
        { enabled: !!address, chainId },
    )

    // Screen-view tracking (screen_asset_detail) is centralized in the
    // navigator's screenListeners (see routes/listeners.ts). This effect only
    // fires the asset-specific "Show" event, which carries the asset id.
    useEffect(() => {
        if (assetId && !isCollectible) {
            trackEvent(AssetDetailsEvent.Show, {
                [AnalyticsMetadataKey.AssetId]: assetId,
                [AnalyticsMetadataKey.ChainId]: chainId,
            })
        }
    }, [assetId, chainId, isCollectible])

    // Dedupe compares rendered strings, so both sides must share the same
    // ('short') truncation — a 'long'-format secondary would never match and
    // the address would render twice again.
    const headerPrimary = getAccountDisplayName(account, chainId)
    const headerSecondary = dedupeSecondaryLabel(
        headerPrimary,
        accountDisplayName,
    )

    return {
        account,
        asset,
        scope,
        isLoading: !isError && (isPending || !asset || !account),
        isError,
        headerPrimary,
        headerSecondary,
        assetDetailsDisplay,
        about,
        supply,
        isNetworkLineVisible,
        isMarketsTabVisible,
    }
}
