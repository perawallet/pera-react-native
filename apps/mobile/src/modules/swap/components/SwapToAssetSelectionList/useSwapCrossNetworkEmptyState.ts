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

import { useCallback, useMemo } from 'react'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { nativeAssetFor, useAssetsQuery } from '@perawallet/wallet-core-assets'
import {
    toScopeKey,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useSwapSourceChains } from '../../hooks/useSwapSourceChains'

type SwapCrossNetworkEmptyState = {
    title: string
    body: string
    /** Null when the selected account can't pay on the picked network. */
    actionLabel: Nullable<string>
}

type UseSwapCrossNetworkEmptyStateParams = {
    /** The pay asset's scope. */
    scope: ChainScope
    fromAssetId: string
    destinationScopes: ChainScope[]
    selectedChainId: Nullable<ChainId>
    isPairsSuccess: boolean
    hasNextPage: boolean
    isSearching: boolean
    hasItems: boolean
    onSwitchPayAsset: (assetId: string, scope: ChainScope) => void
}

export type UseSwapCrossNetworkEmptyStateResult = {
    crossNetworkEmptyState: Nullable<SwapCrossNetworkEmptyState>
    handleSwapOnSelectedNetwork: () => void
}

export const useSwapCrossNetworkEmptyState = ({
    scope,
    fromAssetId,
    destinationScopes,
    selectedChainId,
    isPairsSuccess,
    hasNextPage,
    isSearching,
    hasItems,
    onSwitchPayAsset,
}: UseSwapCrossNetworkEmptyStateParams): UseSwapCrossNetworkEmptyStateResult => {
    const { t } = useLanguage()
    const selectedAccount = useSelectedAccount()
    const sourceChainIds = useSwapSourceChains(selectedAccount)
    const { data: payAssets } = useAssetsQuery(
        scope,
        fromAssetId ? [fromAssetId] : [],
    )
    const payAsset = payAssets?.get(fromAssetId)

    const pickedScope = useMemo(
        () =>
            destinationScopes.find(
                ({ chainId }) => chainId === selectedChainId,
            ) ?? null,
        [destinationScopes, selectedChainId],
    )

    const crossNetworkEmptyState =
        useMemo((): Nullable<SwapCrossNetworkEmptyState> => {
            // An empty list only means "no pairs" after a complete, successful
            // fetch: a failed or still-paging query also leaves it empty.
            if (
                pickedScope === null ||
                toScopeKey(pickedScope) === toScopeKey(scope) ||
                !isPairsSuccess ||
                hasNextPage ||
                isSearching ||
                hasItems
            ) {
                return null
            }
            const { chainId: pickedChainId } = pickedScope
            const canPayOnPicked = sourceChainIds.includes(pickedChainId)
            const params = {
                network: chainDisplayNameOf(pickedChainId),
                payNetwork: chainDisplayNameOf(scope.chainId),
                asset: payAsset?.unitName ?? payAsset?.name ?? fromAssetId,
            }
            return {
                title: t(
                    'swap.asset_selection.cross_network_empty_title',
                    params,
                ),
                body: t(
                    canPayOnPicked
                        ? 'swap.asset_selection.cross_network_empty_body'
                        : 'swap.asset_selection.cross_network_empty_body_other_account',
                    params,
                ),
                actionLabel: canPayOnPicked
                    ? t(
                          'swap.asset_selection.cross_network_empty_action',
                          params,
                      )
                    : null,
            }
        }, [
            pickedScope,
            scope,
            isPairsSuccess,
            hasNextPage,
            isSearching,
            hasItems,
            sourceChainIds,
            payAsset,
            fromAssetId,
            t,
        ])

    const handleSwapOnSelectedNetwork = useCallback(() => {
        if (!crossNetworkEmptyState?.actionLabel || pickedScope === null) {
            return
        }
        onSwitchPayAsset(
            nativeAssetFor(pickedScope.chainId).assetId,
            pickedScope,
        )
    }, [crossNetworkEmptyState, pickedScope, onSwitchPayAsset])

    return { crossNetworkEmptyState, handleSwapOnSelectedNetwork }
}
