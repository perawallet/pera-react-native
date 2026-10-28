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
    useAccountHeldAssetsQuery,
    useAccountHoldingSources,
    useAccountsStore,
    chainAccountOf,
} from '@perawallet/wallet-core-accounts'
import {
    isAssetSearchUnavailableError,
    useAssetSearchAcrossScopesQuery,
    type ScopedAssetSearchResult,
} from '@perawallet/wallet-core-assets'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import {
    useSelectedScope,
    useSelectedScopes,
} from '@perawallet/wallet-core-chain-shared'
import { useAssetOptInMutation } from '@perawallet/wallet-core-transactions'
import type { FilterOption } from '@components/FilterSelection'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useNetworkStatus } from '@modules/network'
import {
    useCapableChainId,
    useCapableChainIds,
} from '@hooks/useCapableChainIds'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { SEARCH_DEBOUNCE_TIME } from '@constants/ui'
import type { AddAssetContentVariant } from '@modules/assets/components/AddAssetContent'
import {
    isIntegrityRequiredError,
    useDebouncedValue,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    assetRefKey,
    toScopeKey,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { toChainFilterOptions } from '../../utils/toChainFilterOptions'

type UseAddAssetViewOptions = {
    variant?: AddAssetContentVariant
    /** The chip the sheet opens on, null for All; the user can switch to another offered one. */
    chainId: Nullable<ChainId>
}

type UseAddAssetViewResult = {
    /** All, where offered, then one per account chain that can search assets; empty while there's nothing to pick. */
    chainOptions: FilterOption<Nullable<ChainId>>[]
    /** The chain search runs on; null searches every offered chain. */
    selectedChainId: Nullable<ChainId>
    handleSelectChain: (chainId: Nullable<ChainId>) => void
    searchQuery: string
    handleSearchChange: (text: string) => void
    results: ScopedAssetSearchResult[]
    /** The results span chains, so each row names its network. */
    showsNetwork: boolean
    isLoading: boolean
    isError: boolean
    isOffline: boolean
    isIntegrityBlocked: boolean
    isUnavailable: boolean
    /** Set when the search found the chain can't be searched here: the default copy is about BetaNet and custom nodes. */
    unavailableBody: Optional<string>
    isFetchingNextPage: boolean
    hasNextPage: boolean
    fetchNextPage: () => void
    /** A chain's search failed while others' results show, so some may be missing. */
    isIncomplete: boolean
    isOptedIn: (result: ScopedAssetSearchResult) => boolean
    isOptingIn: (result: ScopedAssetSearchResult) => boolean
    /** Off: the row offers no add action. */
    canAdd: (result: ScopedAssetSearchResult) => boolean
    handleRequestAdd: (result: ScopedAssetSearchResult) => void
    t: (key: string, params?: Record<string, string | number>) => string
}

// Keyed by chain too, so an asset id added on one chain never reads as added
// on another. The list keys its rows by it as well.
export const resultKey = ({ scope, asset }: ScopedAssetSearchResult): string =>
    assetRefKey({ chainId: scope.chainId, assetId: asset.assetId })

const withKey = (keys: ReadonlySet<string>, key: string): ReadonlySet<string> =>
    new Set(keys).add(key)

const withoutKey = (
    keys: ReadonlySet<string>,
    key: string,
): ReadonlySet<string> => {
    const next = new Set(keys)
    next.delete(key)
    return next
}

export const useAddAssetView = (
    options: UseAddAssetViewOptions,
): UseAddAssetViewResult => {
    const { t } = useLanguage()
    const hasCollectible = options.variant === 'collectible'
    const [optingInKeys, setOptingInKeys] = useState<ReadonlySet<string>>(
        new Set(),
    )
    const [recentlyOptedInKeys, setRecentlyOptedInKeys] = useState<
        ReadonlySet<string>
    >(new Set())
    // Undefined until the user picks a chip.
    const [pickedChainId, setPickedChainId] =
        useState<Optional<Nullable<ChainId>>>(undefined)
    const [searchQuery, setSearchQuery] = useState('')
    const debouncedQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_TIME)

    const selectedAccount = useAccountsStore(state =>
        state.getSelectedAccount(),
    )
    const holdingSources = useAccountHoldingSources(selectedAccount)
    // A chain without asset search would only ever show the unavailable state.
    // A switched-off chain reports every capability off, so it's left out too.
    const searchableChainIds = useCapableChainIds('assetSearch')
    const manageableChainIds = useCapableChainIds('manageAssets')
    // The account's own chains, as Home's chips are. The NFT sheet adds by
    // opting in, so it keeps to chains that can manage assets.
    const offeredChainIds = useMemo(() => {
        const accountChainIds = new Set(
            holdingSources.map(({ scope }) => scope.chainId),
        )
        return searchableChainIds.filter(
            chainId =>
                accountChainIds.has(chainId) &&
                (!hasCollectible || manageableChainIds.includes(chainId)),
        )
    }, [holdingSources, hasCollectible, searchableChainIds, manageableChainIds])
    const isAllOffered = !hasCollectible && offeredChainIds.length > 1
    const chainOptions = useMemo(
        () =>
            toChainFilterOptions(offeredChainIds, {
                allLabel: hasCollectible
                    ? undefined
                    : t('account_details.assets.network_filter_all'),
                testIDPrefix: 'add_asset_network_filter',
            }),
        [offeredChainIds, hasCollectible, t],
    )
    // Derived, never written back: a picked or opening chip that stops being
    // offered falls back to All, or to the first offered chain without one.
    const wantedChainId =
        pickedChainId === undefined ? options.chainId : pickedChainId
    const selectedChainId =
        wantedChainId !== null && offeredChainIds.includes(wantedChainId)
            ? wantedChainId
            : isAllOffered
              ? null
              : (offeredChainIds[0] ?? null)
    const searchedChainIds = useMemo(
        () => (selectedChainId === null ? offeredChainIds : [selectedChainId]),
        [selectedChainId, offeredChainIds],
    )
    const searchScopes = useSelectedScopes(searchedChainIds)

    const {
        results,
        isLoading,
        isError,
        error,
        isPaused,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        isIncomplete,
    } = useAssetSearchAcrossScopesQuery(debouncedQuery, searchScopes, {
        hasCollectible,
    })
    const { hasInternet } = useNetworkStatus()
    const isOffline = isPaused || (isError && !hasInternet)
    const isSearchUnavailable = isError && isAssetSearchUnavailableError(error)
    // The list shows skeletons only while it's empty, so this turns a "No
    // assets found" flash into skeletons; rows already shown stay up. Clearing
    // goes back to the list fetched for the empty query.
    const isDebouncingTypedQuery =
        searchQuery.length > 0 && searchQuery !== debouncedQuery

    // Adding runs through one chain's opt-in mutation, so All adds on its
    // first chain that can manage assets.
    const addChainId =
        selectedChainId ??
        offeredChainIds.find(chainId => manageableChainIds.includes(chainId)) ??
        null
    const canManageAssets =
        addChainId !== null && manageableChainIds.includes(addChainId)
    const fallbackChainId = useCapableChainId('assetSearch')
    const addScope = useSelectedScope(addChainId ?? fallbackChainId)
    const selectedAddress = selectedAccount
        ? chainAccountOf(selectedAccount, addScope.chainId)?.address
        : undefined
    const { optIn } = useAssetOptInMutation(addScope)
    const { showToast } = useToast()
    const { showError } = useErrorToast()
    const { requestByType } = useBottomSheet()

    // Every chain the account is on, not just the searched ones, so picking a
    // chip doesn't start a new read.
    const { heldAssets } = useAccountHeldAssetsQuery(holdingSources)
    const optedInKeys = useMemo(() => {
        const keys = new Set(recentlyOptedInKeys)
        for (const { scope, assetId } of heldAssets) {
            keys.add(assetRefKey({ chainId: scope.chainId, assetId }))
        }
        return keys
    }, [heldAssets, recentlyOptedInKeys])

    const isOptedIn = useCallback(
        (result: ScopedAssetSearchResult) => optedInKeys.has(resultKey(result)),
        [optedInKeys],
    )
    const isOptingIn = useCallback(
        (result: ScopedAssetSearchResult) =>
            optingInKeys.has(resultKey(result)),
        [optingInKeys],
    )
    const addScopeKey = toScopeKey(addScope)
    const canAdd = useCallback(
        (result: ScopedAssetSearchResult) =>
            canManageAssets && toScopeKey(result.scope) === addScopeKey,
        [canManageAssets, addScopeKey],
    )

    const handleRequestAdd = useCallback(
        async (result: ScopedAssetSearchResult) => {
            const key = resultKey(result)
            const sender = selectedAddress
            if (!sender || !canAdd(result) || optingInKeys.has(key)) return
            const { assetId, unitName, name } = result.asset

            const confirmation = await requestByType<'asset-opt-in', 'confirm'>(
                'asset-opt-in',
                { assetId, accountAddress: sender, scope: addScope },
                {
                    size: 'auto',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            )
            if (confirmation !== 'confirm') return

            const assetDisplayName = unitName ?? name ?? null
            setOptingInKeys(prev => withKey(prev, key))

            try {
                await optIn({
                    sender,
                    assetId: BigInt(assetId),
                })
                setRecentlyOptedInKeys(prev => withKey(prev, key))
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
                setOptingInKeys(prev => withoutKey(prev, key))
            }
        },
        [
            selectedAddress,
            canAdd,
            optingInKeys,
            addScope,
            requestByType,
            optIn,
            showToast,
            t,
            showError,
        ],
    )

    const requestAdd = useCallback(
        (result: ScopedAssetSearchResult) => void handleRequestAdd(result),
        [handleRequestAdd],
    )

    return {
        chainOptions,
        selectedChainId,
        handleSelectChain: setPickedChainId,
        searchQuery,
        handleSearchChange: setSearchQuery,
        results,
        showsNetwork: selectedChainId === null && offeredChainIds.length > 1,
        isLoading: isLoading || isDebouncingTypedQuery,
        isError,
        isOffline,
        isIntegrityBlocked: isError && isIntegrityRequiredError(error),
        isUnavailable: offeredChainIds.length === 0 || isSearchUnavailable,
        unavailableBody: isSearchUnavailable
            ? t('common.network_unavailable.generic_body')
            : undefined,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        isIncomplete,
        isOptedIn,
        isOptingIn,
        canAdd,
        handleRequestAdd: requestAdd,
        t,
    }
}

export type { UseAddAssetViewResult }
