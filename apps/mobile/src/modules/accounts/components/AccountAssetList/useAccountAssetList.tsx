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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type ParamListBase, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { PWFlatListRef } from '@components/core'
import {
    addressOn,
    useAccountAssetsQuery,
    useAccountHoldingSources,
    useCanSignWith,
    useHasAccountChainState,
    useIsHoldingsRefreshFailed,
    assetFromHoldingLiteRow,
    accountChainIdOf,
    useRegisteredChainIds,
    type WalletAccount,
    type AccountHoldingsLiteRow,
} from '@perawallet/wallet-core-accounts'
import {
    findNativeAsset,
    useAssetPreferencesStore,
    isCollectible,
} from '@perawallet/wallet-core-assets'
import {
    baseUnitsToDisplayUnits,
    useDebouncedValue,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { trackEvent, AssetDetailsEvent, AnalyticsMetadataKey } from '@analytics'
import { useAssetOptOutMutation } from '@perawallet/wallet-core-transactions'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    useIsChainSwitchedOff,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import type { FilterOption } from '@components/FilterSelection'
import { useCapability } from '@hooks/useCapability'
import { useErrorToast } from '@hooks/useErrorToast'
import { useModalState, type ModalState } from '@hooks/useModalState'
import { useToast } from '@hooks/useToast'
import { SEARCH_DEBOUNCE_TIME_SHORT } from '@constants/ui'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    AddAssetContent,
    useAssetListFiatConverter,
    useGroupedHoldings,
    type AssetFiatConverter,
    type GroupableHoldingAdapter,
    type GroupedHoldingItem,
} from '@modules/assets'
import { useAssetListViewStore } from '../../hooks/useAssetListViewStore'
import { useAccountChainFilterOptions } from '../../hooks/useAccountChainFilterOptions'
import { useSelectedNetworkSource } from '../../hooks/useSelectedNetworkSource'
import { useNftHoldingSources } from '../../hooks/useNftHoldingSources'
import { AssetFilterContent } from '../AssetFilterContent'
import { AssetSortContent } from '../AssetSortContent'
import {
    ManageAssetsContent,
    type ManageAssetsAction,
} from '../ManageAssetsContent'
import { OptOutConfirmationContent } from './OptOutConfirmationContent'

export type AccountAssetListItem =
    | GroupedHoldingItem<AccountHoldingsLiteRow>
    | { kind: 'skeleton'; id: string }

type UseAccountAssetListResult = {
    /** No chain the account holds assets on is available: the header shows the notice, the list stays empty. */
    isChainSwitchedOff: boolean
    /** Eight skeleton rows while the holdings read is pending; empty when every chain is switched off. */
    items: AccountAssetListItem[]
    /** Empty while the account is on fewer than two chains: nothing to filter. */
    chainFilterOptions: FilterOption<Nullable<ChainId>>[]
    /** The selected network, when it holds nothing but its native asset at zero and nothing is searched: the list offers funding it. */
    fundingChainId: Nullable<ChainId>
    /** The chain the list is narrowed to; `null` is All. */
    selectedChainId: Nullable<ChainId>
    setSelectedChainId: (chainId: Nullable<ChainId>) => void
    toggleGroupExpanded: (groupId: string) => void
    convertFiat: AssetFiatConverter
    isReadOnly: boolean
    canManageAssets: boolean
    hideZeroBalance: boolean
    searchFilter: string
    headerState: ModalState
    isOptingOut: boolean
    setSearchFilter: (value: string) => void
    goToAssetScreen: (item: AccountHoldingsLiteRow) => void
    handleOptOut: (item: AccountHoldingsLiteRow) => void
    handleOpenAddAsset: () => void
    handleOpenManage: () => void
    getEmptyTitle: () => string
    getEmptyBody: () => string
    renderItemProps: {
        isReadOnly: boolean
        canManageAssets: boolean
        goToAssetScreen: (item: AccountHoldingsLiteRow) => void
        handleOptOut: (item: AccountHoldingsLiteRow) => void
        /** Opt-out runs on the account's own chain only. */
        isSwipeable: (item: AccountHoldingsLiteRow) => boolean
    }
    listRef: React.MutableRefObject<PWFlatListRef | null>
}

const EMPTY_ITEMS: AccountAssetListItem[] = []

// Listed as rows, not a ListEmptyComponent: SearchableList centres an empty
// component in the leftover height, which pushes a tall skeleton up over the chips.
const ASSET_SKELETON_ITEMS: AccountAssetListItem[] = Array.from(
    { length: 8 },
    (_, i) => ({ kind: 'skeleton', id: `asset-skeleton-${i}` }),
)

// Rows carry base units and parse their metadata lazily; the SQL-read group id
// keeps that parse to group members.
const homeHoldingAdapter: GroupableHoldingAdapter<AccountHoldingsLiteRow> = {
    assetOf: holding => assetFromHoldingLiteRow(holding, holding.scope.chainId),
    displayAmountOf: (holding, asset) =>
        baseUnitsToDisplayUnits(holding.amount, asset.decimals),
    usdPriceOf: holding => holding.usdPrice,
    groupOf: holding =>
        holding.crossChainAssetGroupId === null
            ? null
            : (assetFromHoldingLiteRow(holding, holding.scope.chainId)
                  ?.peraMetadata?.crossChainAssetGroup ?? null),
}

type UseAccountAssetListParams = {
    account: WalletAccount
    t: (key: string) => string
}

export const useAccountAssetList = ({
    account,
    t,
}: UseAccountAssetListParams): UseAccountAssetListResult => {
    const headerState = useModalState(true)
    // The account's own chain: opt-out and asset management act here.
    const scope = useSelectedScope(
        accountChainIdOf(account, useRegisteredChainIds()),
    )
    const accountAddress = addressOn(account, scope) ?? ''
    const isOwnChainSwitchedOff = useIsChainSwitchedOff(scope.chainId)
    const canManageAssets =
        useCapability({
            chain: { chainId: scope.chainId, capability: 'manageAssets' },
        }) && !isOwnChainSwitchedOff
    const { request: requestBottomSheet } = useBottomSheet()

    const sources = useAccountHoldingSources(account)
    // A primitive, so the row press handler keeps its identity across renders.
    const nftChainIds = useNftHoldingSources(account)
        .map(({ scope: { chainId } }) => chainId)
        .join()
    const isChainSwitchedOff = sources.length === 0
    const setSelectedChainId = useAssetListViewStore(
        state => state.setSelectedChainId,
    )
    const expandedGroupIds = useAssetListViewStore(
        state => state.expandedGroupIds,
    )
    const toggleGroupExpanded = useAssetListViewStore(
        state => state.toggleGroupExpanded,
    )
    const selectedSource = useSelectedNetworkSource(sources)
    const selectedChainId = selectedSource?.scope.chainId ?? null
    const querySources = useMemo(
        () =>
            selectedChainId === null
                ? sources
                : sources.filter(
                      source => source.scope.chainId === selectedChainId,
                  ),
        [sources, selectedChainId],
    )
    const chainFilterOptions = useAccountChainFilterOptions(
        sources,
        'asset_network_filter',
    )

    // Search is debounced locally and pushed into the DB query so pagination
    // stays correct over the whole held set (rather than filtering a window).
    const [searchFilter, setSearchFilter] = useState('')
    const debouncedSearch = useDebouncedValue(
        searchFilter,
        SEARCH_DEBOUNCE_TIME_SHORT,
    )

    const hideZeroBalance = useAssetPreferencesStore(
        state => state.hideZeroBalance,
    )
    const displayNfts = useAssetPreferencesStore(state => state.displayNfts)
    const displayOptedInNfts = useAssetPreferencesStore(
        state => state.displayOptedInNfts,
    )
    const assetSortMode = useAssetPreferencesStore(state => state.assetSortMode)
    const effectiveDisplayOptedInNfts = displayNfts && displayOptedInNfts
    const balanceFilters = useMemo(
        () => ({
            hideZeroBalance,
            // A network's own list always opens on its native asset.
            keepZeroNative: selectedChainId !== null,
            hideNfts: !displayNfts,
            hideZeroBalanceNfts: !effectiveDisplayOptedInNfts,
        }),
        [
            hideZeroBalance,
            selectedChainId,
            displayNfts,
            effectiveDisplayOptedInNfts,
        ],
    )

    // DB does the sort + filter + search in one read, returning lightweight
    // rows; FlashList virtualizes rendering and the visible rows materialize
    // their own metadata lazily (see AssetListItemView).
    const { holdings, isPending, isPlaceholderData } = useAccountAssetsQuery(
        querySources,
        {
            filters: balanceFilters,
            sortMode: assetSortMode,
            search: debouncedSearch,
        },
    )

    const expandedGroupIdSet = useMemo(
        () => new Set(expandedGroupIds),
        [expandedGroupIds],
    )
    // A chain chip lists that chain's own rows, so only All over two or more
    // chains can fold anything.
    const { items } = useGroupedHoldings({
        holdings,
        adapter: homeHoldingAdapter,
        expandedGroupIds: expandedGroupIdSet,
        isEnabled: selectedChainId === null && sources.length > 1,
    })

    // Exchange rates read once here; the visible rows convert themselves. Keeps
    // per-row render observer-free without precomputing all N holdings.
    const convertFiat = useAssetListFiatConverter()

    const { optOut, isLoading: isOptingOut } = useAssetOptOutMutation(scope)
    const { showToast } = useToast()
    const { showError } = useErrorToast()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

    useEffect(() => {
        setSearchFilter('')
    }, [account.id])

    const listRef = useRef<PWFlatListRef | null>(null)

    // One reset for both triggers: switching account or sort re-reads holdings
    // under a new query key, so the rows go through a gap — empty while cold, or
    // the previous request's held as placeholder data — before the new ones land.
    // Firing on the *request* and waiting for its own rows is what survives that
    // gap. Scrolling as soon as the request changes lands before the rows do, and
    // the FlashList re-population that follows (with the sticky search bar at
    // index 0) pushes the list past the header; keying off the sort alone missed
    // the reset entirely whenever the rows hadn't arrived yet.
    const viewRequestKey = `${account.id}|${selectedChainId ?? ''}|${assetSortMode}`
    const appliedViewRequestKeyRef = useRef(viewRequestKey)
    const hasRowsForRequest = holdings.length > 0 && !isPlaceholderData

    useEffect(() => {
        if (appliedViewRequestKeyRef.current === viewRequestKey) return
        if (!hasRowsForRequest) return

        const [appliedAccountId] = appliedViewRequestKeyRef.current.split('|')
        // Next frame: FlashList settles its own offset on the layout pass that
        // follows a data change, and a scroll issued before it loses.
        const frame = requestAnimationFrame(() => {
            // Recorded here, not before scheduling: every placeholder gap
            // re-runs this effect and its cleanup cancels the pending frame, so
            // marking the request applied up front turned that cancellation
            // into a reset that silently never happened.
            appliedViewRequestKeyRef.current = viewRequestKey
            listRef.current?.scrollToOffset({
                offset: 0,
                // Animate a re-sort of the list in front of you; an account
                // switch is a new list and should just start at the top.
                animated: appliedAccountId === account.id,
            })
        })
        return () => cancelAnimationFrame(frame)
    }, [viewRequestKey, hasRowsForRequest, account.id])

    const isReadOnly = !useCanSignWith(account, scope.chainId)

    const goToAssetScreen = useCallback(
        (item: AccountHoldingsLiteRow) => {
            headerState.open()
            const { chainId } = item.scope
            const assetInfo = assetFromHoldingLiteRow(item, chainId)
            if (
                assetInfo &&
                isCollectible(assetInfo) &&
                nftChainIds.split(',').includes(chainId)
            ) {
                navigation.navigate('CollectibleDetails', {
                    assetId: item.assetId,
                    chainId,
                })
            } else {
                navigation.navigate('AssetDetails', {
                    assetId: item.assetId,
                    chainId,
                })
            }
        },
        [headerState, navigation, nftChainIds],
    )

    const handleOptOut = useCallback(
        async (item: AccountHoldingsLiteRow) => {
            const result = await requestBottomSheet<'confirm'>({
                contents: (
                    <OptOutConfirmationContent
                        assetId={item.assetId}
                        accountAddress={accountAddress}
                        scope={scope}
                    />
                ),
                options: {
                    size: 'auto',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            })
            if (result !== 'confirm') return

            const asset = assetFromHoldingLiteRow(item, scope.chainId)
            try {
                await optOut({
                    sender: accountAddress,
                    assetId: BigInt(item.assetId),
                    creator: asset?.creator.address,
                })
                showToast({
                    title: t('asset_opt_out.success'),
                    body: '',
                    type: 'success',
                })
            } catch (err) {
                if (err instanceof UserRejectedSigningError) {
                    return
                }
                showError(err, t('asset_opt_out.error'))
            }
        },
        [
            requestBottomSheet,
            accountAddress,
            optOut,
            showToast,
            t,
            showError,
            scope,
        ],
    )

    const handleOpenAddAsset = useCallback(() => {
        trackEvent(AssetDetailsEvent.AddAsset, {
            [AnalyticsMetadataKey.ChainId]: scope.chainId,
        })
        void requestBottomSheet<void>({
            contents: <AddAssetContent chainId={selectedChainId} />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet, selectedChainId, scope.chainId])

    const handleOpenManage = useCallback(async () => {
        trackEvent(AssetDetailsEvent.ManageAsset, {
            [AnalyticsMetadataKey.ChainId]: scope.chainId,
        })
        const action = await requestBottomSheet<ManageAssetsAction>({
            contents: <ManageAssetsContent isReadOnly={isReadOnly} />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        if (!action) return
        if (action === 'sort') {
            void requestBottomSheet<void>({
                contents: <AssetSortContent />,
                options: {
                    size: 'auto',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            })
        } else if (action === 'filter') {
            void requestBottomSheet<void>({
                contents: <AssetFilterContent />,
                options: {
                    size: 'auto',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            })
        } else if (action === 'remove') {
            navigation.navigate('RemoveAssets')
        }
    }, [requestBottomSheet, isReadOnly, navigation, scope.chainId])

    const isRefreshFailed = useIsHoldingsRefreshFailed(
        selectedSource?.scope ?? scope,
        selectedSource?.address ?? '',
    )
    const hasRead = useHasAccountChainState(
        selectedSource?.scope ?? scope,
        selectedSource?.address ?? '',
    )
    // The lone row is the native asset at zero: a failed first read leaves the
    // same row as a saved placeholder, so it reads as unfunded only once a read
    // has succeeded. That signal survives a restart; the failed flag does not.
    const fundingChainId =
        selectedChainId !== null &&
        !isPending &&
        !isPlaceholderData &&
        hasRead &&
        !isRefreshFailed &&
        searchFilter.length === 0 &&
        holdings.length === 1 &&
        holdings[0]!.assetId === findNativeAsset(selectedChainId)?.assetId &&
        holdings[0]!.amount.isZero()
            ? selectedChainId
            : null

    const getEmptyTitle = useCallback(() => {
        if (searchFilter.length > 0) {
            return t('account_details.assets.nomatch_title')
        }
        return t('account_details.assets.empty_title')
    }, [searchFilter, t])

    const getEmptyBody = useCallback(() => {
        if (searchFilter.length > 0) {
            return t('account_details.assets.nomatch_body')
        }
        return t('account_details.assets.empty_body')
    }, [searchFilter, t])

    const isSwipeable = useCallback(
        (item: AccountHoldingsLiteRow) =>
            !isReadOnly &&
            canManageAssets &&
            item.scope.chainId === scope.chainId &&
            findNativeAsset(item.scope.chainId)?.assetId !== item.assetId &&
            item.amount.isZero(),
        [isReadOnly, canManageAssets, scope.chainId],
    )

    const renderItemProps = useMemo(
        () => ({
            isReadOnly,
            canManageAssets,
            goToAssetScreen,
            handleOptOut,
            isSwipeable,
        }),
        [
            isReadOnly,
            canManageAssets,
            goToAssetScreen,
            handleOptOut,
            isSwipeable,
        ],
    )

    return {
        isChainSwitchedOff,
        items: isChainSwitchedOff
            ? EMPTY_ITEMS
            : isPending
              ? ASSET_SKELETON_ITEMS
              : items,
        chainFilterOptions,
        fundingChainId,
        selectedChainId,
        setSelectedChainId,
        toggleGroupExpanded,
        convertFiat,
        isReadOnly,
        canManageAssets,
        listRef,
        hideZeroBalance,
        searchFilter,
        headerState,
        isOptingOut,
        setSearchFilter,
        goToAssetScreen,
        handleOptOut: (item: AccountHoldingsLiteRow) => void handleOptOut(item),
        handleOpenAddAsset,
        handleOpenManage: () => void handleOpenManage(),
        getEmptyTitle,
        getEmptyBody,
        renderItemProps,
    }
}
