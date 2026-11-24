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
import {
    getAccountDisplayName,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { formatAssetAmount } from '@perawallet/wallet-core-assets'
import {
    generateUniqueId,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    swapAccountKey,
    swapExplorerUrlFor,
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

    const filterableAccounts = useMemo(
        () =>
            signingAccounts.filter(account =>
                addresses.some(entry => entry.accountId === account.id),
            ),
        [signingAccounts, addresses],
    )
    const canFilter = filterableAccounts.length > 1
    const selectedAccountId =
        canFilter &&
        filterableAccounts.some(account => account.id === pickedAccountId)
            ? pickedAccountId
            : null

    const accountOptions = useMemo(() => {
        if (!canFilter) return []
        const nameOf = (account: WalletAccount) => {
            const first = addresses.find(
                entry => entry.accountId === account.id,
            )
            return getAccountDisplayName(
                account,
                first?.scope.chainId ?? 'algorand',
            )
        }
        return [
            {
                value: null,
                label: t('swap.history.list.account_filter_all'),
                testID: 'swap_history_account_filter_all',
            },
            ...filterableAccounts.map(account => ({
                value: account.id,
                label: nameOf(account),
                testID: `swap_history_account_filter_${account.id}`,
            })),
        ]
    }, [canFilter, filterableAccounts, addresses, t])

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
        fetchNextPage,
    } = useSwapHistoryInfiniteQuery(accounts, VISIBLE_SWAP_STATUSES)

    const swaps = useMemo(() => {
        const accountIdByKey = new Map(
            addresses.map(entry => [swapAccountKey(entry), entry.accountId]),
        )
        const accountById = new Map(
            signingAccounts.map(account => [account.id, account]),
        )
        return loaded.filter(hasAssets).map(item => {
            const payerId = item.sourceAccount
                ? accountIdByKey.get(swapAccountKey(item.sourceAccount))
                : undefined
            const payer = payerId ? accountById.get(payerId) : undefined
            const { chainId, networkId } = item.assetIn.ref
            return {
                ...item,
                amountInLabel: item.amountIn
                    ? formatAssetAmount(item.amountIn, item.assetIn)
                    : NO_AMOUNT,
                amountOutLabel: item.amountOut
                    ? formatAssetAmount(item.amountOut, item.assetOut)
                    : NO_AMOUNT,
                accountName:
                    payer && item.sourceAccount
                        ? getAccountDisplayName(
                              payer,
                              item.sourceAccount.scope.chainId,
                          )
                        : undefined,
                explorerUrl: swapExplorerUrlFor({ chainId, networkId }, item),
            }
        })
    }, [loaded, addresses, signingAccounts])

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
    // newest history is all hidden, so read on until something shows or the
    // history ends.
    const shouldReadOn =
        swaps.length === 0 &&
        hasNextPage &&
        !isLoading &&
        !isFetchingNextPage &&
        !isError
    useEffect(() => {
        if (shouldReadOn) fetchNextPage()
    }, [shouldReadOn, fetchNextPage])

    const shouldShowNotOnDeviceState =
        isAccountNotOnDevice && swaps.length === 0
    const shouldShowErrorState =
        !shouldShowNotOnDeviceState && isError && swaps.length === 0
    const shouldShowEmptyState =
        !shouldShowNotOnDeviceState &&
        !isLoading &&
        !hasNextPage &&
        swaps.length === 0

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
    }
}
