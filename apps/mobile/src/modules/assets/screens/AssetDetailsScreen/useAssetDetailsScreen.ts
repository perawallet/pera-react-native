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

import { useCallback, useEffect, useMemo } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    chainAccountOf,
    getAccountDisplayName,
    useAccountHoldingSources,
    useAccountHoldingsAcrossChainsQuery,
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useAssetGroupsQuery,
    useSingleAssetDetailsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    isNativeAsset,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    chainDisplayNameOf,
    getChainDescriptor,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import {
    dedupeSecondaryLabel,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { trackEvent, AssetDetailsEvent, AnalyticsMetadataKey } from '@analytics'
import type { FilterOption } from '@components/FilterSelection'
import { useResolvedAddress } from '@hooks/useResolvedAddress'
import type { AccountStackParamsList } from '@modules/accounts'
import { chainUiFor } from '@modules/chain-ui'
import { findGroupedMembers } from '../../utils/groupedHoldings'
import type {
    AssetAboutDisplay,
    AssetDetailsDisplay,
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
    /** One per network the account holds this asset's group on; empty below two. */
    networkOptions: FilterOption<ChainId>[]
    /** Swaps the screen to that network's holding in place. */
    selectNetwork: (chainId: ChainId) => void
}

export const useAssetDetailsScreen = ({
    assetId,
    chainId,
    isCollectible,
}: UseAssetDetailsScreenParams): UseAssetDetailsScreenResult => {
    const account = useSelectedAccount()
    const scope = useSelectedScope(chainId)
    const navigation =
        useNavigation<
            NativeStackNavigationProp<AccountStackParamsList, 'AssetDetails'>
        >()
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

    const about = useMemo(
        () =>
            asset
                ? assetDetailsDisplay.resolveAbout({
                      asset,
                      scope,
                      descriptor,
                      isNativeAsset: isNativeAsset(
                          { chainId, assetId },
                          descriptor,
                      ),
                  })
                : null,
        [asset, assetDetailsDisplay, scope, descriptor, chainId, assetId],
    )

    const address = account
        ? chainAccountOf(account, chainId)?.address
        : undefined
    const { displayName: accountDisplayName } = useResolvedAddress(
        address ?? '',
        { enabled: !!address, chainId },
    )

    // Groups only fold across chains, so an account on one chain never asks.
    const holdingSources = useAccountHoldingSources(account)
    const isNetworkSwitchable = !isCollectible && holdingSources.length > 1
    const { groups } = useAssetGroupsQuery({ enabled: isNetworkSwitchable })
    const { assetBalances } = useAccountHoldingsAcrossChainsQuery(
        isNetworkSwitchable ? account : null,
    )
    const assetIdByNetwork = useMemo(() => {
        const members = isNetworkSwitchable
            ? findGroupedMembers({
                  holdings: assetBalances,
                  groups,
                  ref: { chainId, assetId },
              })
            : []
        return new Map(
            members.map(member => [member.scope.chainId, member.assetId]),
        )
    }, [isNetworkSwitchable, assetBalances, groups, chainId, assetId])
    const networkOptions = useMemo(
        (): FilterOption<ChainId>[] =>
            [...assetIdByNetwork.keys()].map(networkChainId => ({
                value: networkChainId,
                label: chainDisplayNameOf(networkChainId) ?? networkChainId,
                testID: `asset_network_chip_${networkChainId}`,
            })),
        [assetIdByNetwork],
    )
    const selectNetwork = useCallback(
        (nextChainId: ChainId) => {
            const nextAssetId = assetIdByNetwork.get(nextChainId)
            if (nextAssetId === undefined) return
            navigation.setParams({ chainId: nextChainId, assetId: nextAssetId })
        },
        [assetIdByNetwork, navigation],
    )

    // Screen-view tracking (screen_asset_detail) is centralized in the
    // navigator's screenListeners (see routes/listeners.ts). This effect only
    // fires the asset-specific "Show" event, which carries the asset id.
    useEffect(() => {
        if (assetId && !isCollectible) {
            trackEvent(AssetDetailsEvent.Show, {
                [AnalyticsMetadataKey.AssetId]: assetId,
            })
        }
    }, [assetId, isCollectible])

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
        networkOptions,
        selectNetwork,
    }
}
