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

import { useCallback, useMemo, useState } from 'react'
import {
    useAccountBalancesQuery,
    useAccountsStore,
    useEnableChain,
    chainAccountOf,
    eligibleChainsInFamily,
} from '@perawallet/wallet-core-accounts'
import type { DisplayableAsset } from '@perawallet/wallet-core-assets'
import { useGlobalSearch } from '@perawallet/wallet-core-search'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import {
    chainDisplayNameOf,
    useSelectedScope,
    useSwitchedOffChainIds,
} from '@perawallet/wallet-core-chain-shared'
import { useAssetOptInMutation } from '@perawallet/wallet-core-transactions'
import type { FilterOption } from '@components/FilterSelection'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useNetworkStatus } from '@modules/network'
import { useCapability } from '@hooks/useCapability'
import { useCapableChainIds } from '@hooks/useCapableChainIds'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { SEARCH_DEBOUNCE_TIME } from '@constants/ui'
import type { AddAssetContentVariant } from '@modules/assets/components/AddAssetContent'
import {
    isIntegrityRequiredError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'

type UseAddAssetViewOptions = {
    variant?: AddAssetContentVariant
    /** The chain the sheet opens on; the user can switch to another offered chain. */
    chainId: ChainId
}

type UseAddAssetViewResult = {
    /** One per chain that can search assets; empty while only one can, as there's nothing to pick. */
    chainOptions: FilterOption<ChainId>[]
    /** The chain search, opted-in state and add run on. */
    selectedChainId: ChainId
    handleSelectChain: (chainId: ChainId) => void
    searchQuery: string
    handleSearchChange: (text: string) => void
    results: DisplayableAsset[]
    isLoading: boolean
    isError: boolean
    isOffline: boolean
    isIntegrityBlocked: boolean
    isUnavailable: boolean
    isFetchingNextPage: boolean
    hasNextPage: boolean
    fetchNextPage: Nullable<() => void>
    /** Asset ids on the selected chain. */
    optedInAssetIds: Set<string>
    /** Asset ids on the selected chain. */
    optingInAssetIds: Set<string>
    /** Off: rows offer no add action on the selected chain. */
    canManageAssets: boolean
    handleRequestAdd: (assetId: string) => void
    t: (key: string, params?: Record<string, string | number>) => string
}

// Keyed by chain as well, so an asset added on one chain never reads as added
// on another after the user switches chips.
const chainAssetKey = (chainId: ChainId, assetId: string): string =>
    `${chainId}:${assetId}`

const assetIdsOn = (keys: Set<string>, chainId: ChainId): Set<string> => {
    const prefix = chainAssetKey(chainId, '')
    const ids = new Set<string>()
    for (const key of keys) {
        if (key.startsWith(prefix)) ids.add(key.slice(prefix.length))
    }
    return ids
}

export const useAddAssetView = (
    options: UseAddAssetViewOptions,
): UseAddAssetViewResult => {
    const { t } = useLanguage()
    const hasCollectible = options.variant === 'collectible'
    const [optingInKeys, setOptingInKeys] = useState<Set<string>>(new Set())
    const [recentlyOptedInKeys, setRecentlyOptedInKeys] = useState<Set<string>>(
        new Set(),
    )

    const [pickedChainId, setPickedChainId] = useState<Nullable<ChainId>>(null)

    const selectedAccount = useAccountsStore(state =>
        state.getSelectedAccount(),
    )
    // A chain without asset search would only ever show the unavailable state.
    const searchableChainIds = useCapableChainIds('assetSearch')
    const switchedOffChainIds = useSwitchedOffChainIds()
    const offeredChainIds = useMemo(
        () =>
            searchableChainIds.filter(
                chainId => !switchedOffChainIds.includes(chainId),
            ),
        [searchableChainIds, switchedOffChainIds],
    )
    // Derived, never written back: a picked or opening chain that stops being
    // offered falls through to the first offered one.
    const selectedChainId =
        [pickedChainId, options.chainId].find(
            (chainId): chainId is ChainId =>
                chainId !== null && offeredChainIds.includes(chainId),
        ) ??
        offeredChainIds[0] ??
        options.chainId
    const chainOptions = useMemo(
        (): FilterOption<ChainId>[] =>
            offeredChainIds.length < 2
                ? []
                : offeredChainIds.map(chainId => ({
                      value: chainId,
                      label: chainDisplayNameOf(chainId) ?? chainId,
                      testID: `add_asset_network_filter_${chainId}`,
                  })),
        [offeredChainIds],
    )
    // An account not on the chain yet is enabled there on add.
    const scope = useSelectedScope(selectedChainId)
    const canManageAssets = useCapability({
        chain: { chainId: scope.chainId, capability: 'manageAssets' },
    })
    const selectedAddress = selectedAccount
        ? chainAccountOf(selectedAccount, scope.chainId)?.address
        : undefined
    const { accountBalances } = useAccountBalancesQuery(
        selectedAccount ? [selectedAccount] : [],
        scope,
    )
    const { optIn } = useAssetOptInMutation(scope)
    const enableChain = useEnableChain()
    const { showToast } = useToast()
    const { showError } = useErrorToast()
    const { requestByType } = useBottomSheet()

    const {
        value: searchQuery,
        setValue: setSearchQuery,
        results: searchResults,
        isLoading,
        isRemoteError,
        remoteError,
        isRemotePaused,
        isRemoteUnavailableOnNetwork: isUnavailable,
        hasNextRemotePage: hasNextPage,
        isFetchingNextRemotePage: isFetchingNextPage,
        fetchNextRemotePage: fetchNextPage,
    } = useGlobalSearch(scope, {
        debounceMs: SEARCH_DEBOUNCE_TIME,
        scopes: ['assets'],
        remoteAssets: { hasCollectible, showOnEmptyQuery: true },
    })
    const results = searchResults.remoteAssets
    const { hasInternet } = useNetworkStatus()
    const isError = isRemoteError
    const isOffline = isRemotePaused || (isRemoteError && !hasInternet)

    const optedInAssetIds = useMemo(() => {
        const ids = new Set<string>()
        if (selectedAddress) {
            const balances = accountBalances.get(selectedAddress)
            if (balances) {
                for (const balance of balances.assetBalances) {
                    ids.add(balance.assetId)
                }
            }
        }
        for (const id of assetIdsOn(recentlyOptedInKeys, scope.chainId)) {
            ids.add(id)
        }
        return ids
    }, [accountBalances, selectedAddress, recentlyOptedInKeys, scope.chainId])
    const optingInAssetIds = useMemo(
        () => assetIdsOn(optingInKeys, scope.chainId),
        [optingInKeys, scope.chainId],
    )

    const handleSearchChange = useCallback(
        (text: string) => {
            setSearchQuery(text)
        },
        [setSearchQuery],
    )

    // Starting to add an asset on a chain a local key could be on, but
    // isn't yet, enables that chain: the user has started using it there.
    const resolveSender = useCallback(async (): Promise<string | undefined> => {
        if (selectedAddress || !selectedAccount) return selectedAddress
        if (
            selectedAccount.custody.kind !== 'local' ||
            !eligibleChainsInFamily(selectedAccount).includes(scope.chainId)
        ) {
            return undefined
        }
        const account = await enableChain(
            selectedAccount.id,
            scope.chainId,
            'user',
        )
        return chainAccountOf(account, scope.chainId)?.address
    }, [selectedAddress, selectedAccount, scope.chainId, enableChain])

    const handleRequestAdd = useCallback(
        async (assetId: string) => {
            const key = chainAssetKey(scope.chainId, assetId)
            if (!canManageAssets || optingInKeys.has(key)) return
            let sender: string | undefined
            try {
                sender = await resolveSender()
            } catch (err) {
                showError(err, t('add_asset.opt_in.failed_title'))
                return
            }
            if (!sender) return

            const result = await requestByType<'asset-opt-in', 'confirm'>(
                'asset-opt-in',
                { assetId, accountAddress: sender, scope },
                {
                    size: 'auto',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            )
            if (result !== 'confirm') return

            const pendingAsset = results.find(r => r.assetId === assetId)
            const assetDisplayName =
                pendingAsset?.unitName ?? pendingAsset?.name ?? null
            setOptingInKeys(prev => new Set(prev).add(key))

            try {
                await optIn({
                    sender,
                    assetId: BigInt(assetId),
                })
                setRecentlyOptedInKeys(prev => new Set(prev).add(key))
                showToast({
                    title: t('add_asset.opt_in.success_title'),
                    body: assetDisplayName
                        ? t('add_asset.opt_in.success_body', {
                              assetName: assetDisplayName,
                          })
                        : t('add_asset.opt_in.success_body_generic'),
                    type: 'success',
                })
            } catch (err) {
                if (err instanceof UserRejectedSigningError) {
                    return
                }
                showError(err, t('add_asset.opt_in.failed_title'))
            } finally {
                setOptingInKeys(prev => {
                    const next = new Set(prev)
                    next.delete(key)
                    return next
                })
            }
        },
        [
            canManageAssets,
            resolveSender,
            scope,
            optingInKeys,
            requestByType,
            results,
            optIn,
            showToast,
            t,
            showError,
        ],
    )

    return {
        chainOptions,
        selectedChainId,
        handleSelectChain: setPickedChainId,
        searchQuery,
        handleSearchChange,
        results,
        isLoading,
        isError,
        isOffline,
        isIntegrityBlocked:
            isRemoteError && isIntegrityRequiredError(remoteError),
        isUnavailable,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        optedInAssetIds,
        optingInAssetIds,
        canManageAssets,
        handleRequestAdd: (assetId: string) => void handleRequestAdd(assetId),
        t,
    }
}

export type { UseAddAssetViewResult }
