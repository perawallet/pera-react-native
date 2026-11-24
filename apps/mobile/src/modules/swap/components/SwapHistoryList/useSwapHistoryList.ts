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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatAssetAmount } from '@perawallet/wallet-core-assets'
import {
    generateUniqueId,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    swapAccountKey,
    swapExplorerUrlFor,
    useSwapAccountNames,
    useSwapAccountsAddresses,
    useSwapHistoryInfiniteQuery,
    useSwapSigningAccounts,
    type SwapAsset,
    type SwapHistoryItem,
} from '@perawallet/wallet-core-swaps'
import { trackEvent, SwapEvent, AnalyticsMetadataKey } from '@analytics'
import type { FilterOption } from '@components/FilterSelection'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@modules/webview'

import { VISIBLE_SWAP_STATUSES } from '../../constants'

/** A row the list can draw: rows naming an asset this wallet can't resolve are left out. */
export type ListedSwapHistoryItem = SwapHistoryItem & {
    assetIn: SwapAsset
    assetOut: SwapAsset
    /** Rounded for display, with the unit; "-" when the router sent no amount. */
    amountInLabel: string
    amountOutLabel: string
    /** The wallet account that paid; absent when it isn't one of this wallet's swap accounts. */
    accountName: Optional<string>
    /** Absent until the router lists the swap's own transaction. */
    explorerUrl: Optional<string>
}

const hasAssets = (
    item: SwapHistoryItem,
): item is SwapHistoryItem & { assetIn: SwapAsset; assetOut: SwapAsset } =>
    item.assetIn !== null && item.assetOut !== null

const NO_AMOUNT = '-'

// Bounds the automatic reading past pages with nothing visible, so a history of
// only hidden rows can't be walked end to end without the user asking.
const MAX_AUTO_PAGES = 5

export type UseSwapHistoryListParams = {
    onClose: () => void
}

export type UseSwapHistoryListResult = {
    swaps: ListedSwapHistoryItem[]
    isLoading: boolean
    isError: boolean
    isFetchingNextPage: boolean
    /** All accounts, then one per account; empty unless two or more accounts have swap addresses. */
    accountOptions: FilterOption<Nullable<string>>[]
    /** Null on All accounts. */
    selectedAccountId: Nullable<string>
    handleSelectAccount: (accountId: Nullable<string>) => void
    keyExtractor: (item: ListedSwapHistoryItem) => string
    handleItemPress: (item: ListedSwapHistoryItem) => void
    handleEndReached: () => void
    /** No address here is one this device's registration sends, so the router has no history for it. */
    shouldShowNotOnDeviceState: boolean
    shouldShowErrorState: boolean
    shouldShowEmptyState: boolean
    /** Nothing is visible yet but older pages remain, after the automatic reading stopped. */
    shouldShowLoadMore: boolean
}

export const useSwapHistoryList = ({
    onClose,
}: UseSwapHistoryListParams): UseSwapHistoryListResult => {
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    const signingAccounts = useSwapSigningAccounts()
    const addresses = useSwapAccountsAddresses(signingAccounts)
    const [pickedAccountId, setPickedAccountId] =
        useState<Nullable<string>>(null)

    const { names: namedAccounts, isMultiAccount: canFilter } =
        useSwapAccountNames(signingAccounts)
    const selectedAccountId =
        canFilter &&
        namedAccounts.some(({ accountId }) => accountId === pickedAccountId)
            ? pickedAccountId
            : null

    const accountOptions = useMemo(
        () =>
            canFilter
                ? [
                      {
                          value: null,
                          label: t('swap.history.list.account_filter_all'),
                          testID: 'swap_history_account_filter_all',
                      },
                      ...namedAccounts.map(({ accountId, name }) => ({
                          value: accountId,
                          label: name,
                          testID: `swap_history_account_filter_${accountId}`,
                      })),
                  ]
                : [],
        [canFilter, namedAccounts, t],
    )

    const accounts = useMemo(
        () =>
            addresses
                .filter(
                    entry =>
                        selectedAccountId === null ||
                        entry.accountId === selectedAccountId,
                )
                .map(({ scope, address, isOnDevice }) => ({
                    scope,
                    address,
                    isOnDevice,
                })),
        [addresses, selectedAccountId],
    )

    const {
        swaps: loaded,
        isLoading,
        isError,
        isAccountNotOnDevice,
        isFetchingNextPage,
        hasNextPage,
        hasFailedBatch,
        readKey,
        fetchNextPage,
    } = useSwapHistoryInfiniteQuery(accounts, VISIBLE_SWAP_STATUSES)

    const swaps = useMemo(() => {
        const accountIdByKey = new Map(
            addresses.map(entry => [swapAccountKey(entry), entry.accountId]),
        )
        const nameById = new Map(
            namedAccounts.map(({ accountId, name }) => [accountId, name]),
        )
        return loaded.filter(hasAssets).map(item => {
            const payerId = item.sourceAccount
                ? accountIdByKey.get(swapAccountKey(item.sourceAccount))
                : undefined
            const { chainId, networkId } = item.assetIn.ref
            return {
                ...item,
                amountInLabel: item.amountIn
                    ? formatAssetAmount(item.amountIn, item.assetIn)
                    : NO_AMOUNT,
                amountOutLabel: item.amountOut
                    ? formatAssetAmount(item.amountOut, item.assetOut)
                    : NO_AMOUNT,
                // A wallet with one account has nothing to tell apart.
                accountName:
                    canFilter && payerId ? nameById.get(payerId) : undefined,
                explorerUrl: swapExplorerUrlFor({ chainId, networkId }, item),
            }
        })
    }, [loaded, addresses, namedAccounts, canFilter])

    const keyExtractor = useCallback(
        (item: ListedSwapHistoryItem) => item.orderId,
        [],
    )

    const handleSelectAccount = useCallback(
        (accountId: Nullable<string>) => setPickedAccountId(accountId),
        [],
    )

    const handleItemPress = useCallback(
        (item: ListedSwapHistoryItem) => {
            const url = item.explorerUrl
            if (!url) return
            trackEvent(SwapEvent.SelectHistoryInSeeAll, {
                [AnalyticsMetadataKey.ChainId]: item.assetIn.ref.chainId,
                [AnalyticsMetadataKey.SwapPairing]: `${item.assetIn.unitName}/${item.assetOut.unitName}`,
            })
            onClose()
            // oxlint-disable-next-line pera/no-unvalidated-open-url -- swap adapter builds it from the chain's explorer config
            pushWebView({ url, id: generateUniqueId() })
        },
        [onClose, pushWebView],
    )

    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage()
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    // Older pages may hold the first visible row, e.g. when another account's
    // newest history is all hidden, so read on, a few pages at most, until
    // something shows or the history ends.
    // Keyed on what is read, so a new account set (or a device id registering)
    // starts a fresh budget in the same render.
    const [budget, setBudget] = useState({ key: readKey, count: 0 })
    const autoPages = budget.key === readKey ? budget.count : 0
    const isReadingOn =
        swaps.length === 0 && hasNextPage && autoPages < MAX_AUTO_PAGES
    const shouldReadOn =
        isReadingOn && !isLoading && !isFetchingNextPage && !isError
    useEffect(() => {
        if (!shouldReadOn) return
        setBudget(previous => ({
            key: readKey,
            count: (previous.key === readKey ? previous.count : 0) + 1,
        }))
        fetchNextPage()
    }, [shouldReadOn, fetchNextPage, readKey])

    const shouldShowNotOnDeviceState =
        isAccountNotOnDevice && swaps.length === 0
    // A failed batch may hold the swaps, so it reads as an error, never as empty.
    const shouldShowErrorState =
        !shouldShowNotOnDeviceState &&
        (isError || hasFailedBatch) &&
        swaps.length === 0
    const shouldShowEmptyState =
        !shouldShowNotOnDeviceState &&
        !shouldShowErrorState &&
        !isLoading &&
        !hasNextPage &&
        swaps.length === 0
    // Past the reading budget older pages may still hold a swap: offer them
    // rather than claiming the history is empty.
    const shouldShowLoadMore =
        !shouldShowNotOnDeviceState &&
        !shouldShowErrorState &&
        swaps.length === 0 &&
        hasNextPage &&
        !isReadingOn &&
        !isLoading &&
        !isFetchingNextPage

    return {
        swaps,
        isLoading,
        isError,
        isFetchingNextPage,
        accountOptions,
        selectedAccountId,
        handleSelectAccount,
        keyExtractor,
        handleItemPress,
        handleEndReached,
        shouldShowNotOnDeviceState,
        shouldShowErrorState,
        shouldShowEmptyState,
        shouldShowLoadMore,
    }
}
